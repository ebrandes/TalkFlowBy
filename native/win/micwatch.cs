// Diz quais processos estão capturando o microfone agora, pelo próprio sistema de áudio (WASAPI).
// O registro do Windows (ConsentStore) deixou de ser atualizado em versões recentes do Windows 11,
// então ele não serve mais para saber quando uma chamada começa.
//
// Uso: micwatch.exe [segundos]
// A cada intervalo imprime uma linha JSON:
//   {"apps":[{"pid":1234,"chain":["msedgewebview2.exe","ms-teams.exe","explorer.exe"]}],
//    "windows":[{"exe":"ms-teams.exe","title":"Daily | Microsoft Teams"}]}
// "chain" é o nome do .exe que captura seguido dos processos pais, para achar o app por trás do
// WebView2 ou de um processo auxiliar do navegador. "windows" são os títulos das janelas visíveis
// do Teams, do Zoom e dos navegadores: é por eles que o app sabe *qual* reunião está aberta
// (a janela da chamada do Teams, a aba do Meet) e separa uma chamada da seguinte.
// Sai sozinho quando o app fecha a saída.
//
// Compilado com o csc.exe do .NET Framework que já vem no Windows (scripts/build-micwatch.mjs).
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

static class MicWatch {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCo {}

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
  }

  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int Item(int index, out IMMDevice device);
  }

  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
  }

  [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 {
    [PreserveSig] int GetAudioSessionControl(IntPtr a, int b, out IntPtr c);
    [PreserveSig] int GetSimpleAudioVolume(IntPtr a, int b, out IntPtr c);
    [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator e);
  }

  [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int GetSession(int index, out IAudioSessionControl2 session);
  }

  [ComImport, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    [PreserveSig] int GetState(out int state);
    [PreserveSig] int GetDisplayName(out IntPtr name);
    [PreserveSig] int SetDisplayName(IntPtr a, IntPtr b);
    [PreserveSig] int GetIconPath(out IntPtr a);
    [PreserveSig] int SetIconPath(IntPtr a, IntPtr b);
    [PreserveSig] int GetGroupingParam(out Guid g);
    [PreserveSig] int SetGroupingParam(IntPtr a, IntPtr b);
    [PreserveSig] int RegisterAudioSessionNotification(IntPtr a);
    [PreserveSig] int UnregisterAudioSessionNotification(IntPtr a);
    [PreserveSig] int GetSessionIdentifier(out IntPtr a);
    [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr a);
    [PreserveSig] int GetProcessId(out uint pid);
    [PreserveSig] int IsSystemSoundsSession();
    [PreserveSig] int SetDuckingPreference(bool b);
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct PROCESSENTRY32 {
    public uint dwSize;
    public uint cntUsage;
    public uint th32ProcessID;
    public IntPtr th32DefaultHeapID;
    public uint th32ModuleID;
    public uint cntThreads;
    public uint th32ParentProcessID;
    public int pcPriClassBase;
    public uint dwFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
  }

  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32FirstW(IntPtr snap, ref PROCESSENTRY32 e);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32NextW(IntPtr snap, ref PROCESSENTRY32 e);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

  delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr hwnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern int GetWindowTextLengthW(IntPtr hwnd);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);

  /** Só as janelas destes programas interessam (o resto nem sai do helper). */
  static readonly HashSet<string> WindowApps = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
    "ms-teams.exe", "teams.exe", "msedgewebview2.exe", "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "arc.exe", "zoom.exe"
  };

  const int eCapture = 1;
  const int DEVICE_STATE_ACTIVE = 1;
  const int CLSCTX_ALL = 23;
  const int AudioSessionStateActive = 1;
  const int MaxChain = 6;

  class Proc {
    public string Name;
    public uint Parent;
  }

  static Dictionary<uint, Proc> Processes() {
    var map = new Dictionary<uint, Proc>();
    IntPtr snap = CreateToolhelp32Snapshot(2 /* TH32CS_SNAPPROCESS */, 0);
    if (snap == IntPtr.Zero || snap == new IntPtr(-1)) return map;
    try {
      var e = new PROCESSENTRY32();
      e.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
      if (Process32FirstW(snap, ref e)) {
        do { map[e.th32ProcessID] = new Proc { Name = e.szExeFile, Parent = e.th32ParentProcessID }; }
        while (Process32NextW(snap, ref e));
      }
    } finally {
      CloseHandle(snap);
    }
    return map;
  }

  static void Release(object o) {
    if (o != null && Marshal.IsComObject(o)) Marshal.ReleaseComObject(o);
  }

  /** Processos com uma sessão de captura ativa em qualquer microfone ligado. */
  static List<uint> CapturingPids() {
    var pids = new List<uint>();
    IMMDeviceEnumerator en = null;
    IMMDeviceCollection devs = null;
    try {
      en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCo();
      if (en.EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE, out devs) != 0 || devs == null) return pids;
      int n;
      devs.GetCount(out n);
      Guid iid = typeof(IAudioSessionManager2).GUID;
      for (int i = 0; i < n; i++) {
        IMMDevice dev = null;
        object o = null;
        IAudioSessionEnumerator se = null;
        try {
          if (devs.Item(i, out dev) != 0 || dev == null) continue;
          if (dev.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out o) != 0 || o == null) continue;
          var mgr = (IAudioSessionManager2)o;
          if (mgr.GetSessionEnumerator(out se) != 0 || se == null) continue;
          int count;
          se.GetCount(out count);
          for (int j = 0; j < count; j++) {
            IAudioSessionControl2 s = null;
            try {
              if (se.GetSession(j, out s) != 0 || s == null) continue;
              int state;
              if (s.GetState(out state) != 0 || state != AudioSessionStateActive) continue;
              uint pid;
              // Sessões com vários processos devolvem um código de aviso, mas o pid vem preenchido.
              s.GetProcessId(out pid);
              if (pid != 0 && !pids.Contains(pid)) pids.Add(pid);
            } finally {
              Release(s);
            }
          }
        } finally {
          Release(se);
          Release(o);
          Release(dev);
        }
      }
    } finally {
      Release(devs);
      Release(en);
    }
    return pids;
  }

  /** Títulos das janelas visíveis dos apps de reunião e navegadores. */
  static List<KeyValuePair<string, string>> Windows(Dictionary<uint, Proc> procs) {
    var list = new List<KeyValuePair<string, string>>();
    EnumWindows((hwnd, l) => {
      try {
        if (!IsWindowVisible(hwnd)) return true;
        int len = GetWindowTextLengthW(hwnd);
        if (len <= 0) return true;
        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        Proc p;
        if (!procs.TryGetValue(pid, out p) || !WindowApps.Contains(p.Name)) return true;
        var sb = new StringBuilder(Math.Min(len, 512) + 1);
        GetWindowTextW(hwnd, sb, sb.Capacity);
        string title = sb.ToString().Trim();
        if (title.Length > 0 && list.Count < 64) list.Add(new KeyValuePair<string, string>(p.Name, title));
      } catch (Exception) {
        // Uma janela que some no meio da leitura não derruba o relatório.
      }
      return true;
    }, IntPtr.Zero);
    return list;
  }

  static void Json(StringBuilder sb, string s) {
    sb.Append('"');
    foreach (char c in s) {
      if (c == '"') sb.Append("\\\"");
      else if (c == '\\') sb.Append("\\\\");
      else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
      else sb.Append(c);
    }
    sb.Append('"');
  }

  static string Report(Dictionary<uint, Proc> procs) {
    var sb = new StringBuilder("{\"apps\":[");
    bool first = true;
    foreach (uint pid in CapturingPids()) {
      var chain = new List<string>();
      var seen = new HashSet<uint>();
      uint cur = pid;
      while (cur != 0 && chain.Count < MaxChain && seen.Add(cur)) {
        Proc p;
        if (!procs.TryGetValue(cur, out p)) break;
        chain.Add(p.Name);
        cur = p.Parent;
      }
      if (chain.Count == 0) continue;
      if (!first) sb.Append(',');
      first = false;
      sb.Append("{\"pid\":").Append(pid).Append(",\"chain\":[");
      for (int k = 0; k < chain.Count; k++) {
        if (k > 0) sb.Append(',');
        // Nomes de arquivo no Windows não têm aspas nem barra invertida.
        sb.Append('"').Append(chain[k]).Append('"');
      }
      sb.Append("]}");
    }
    sb.Append("],\"windows\":[");
    first = true;
    try {
      foreach (var w in Windows(procs)) {
        if (!first) sb.Append(',');
        first = false;
        sb.Append("{\"exe\":");
        Json(sb, w.Key);
        sb.Append(",\"title\":");
        Json(sb, w.Value);
        sb.Append('}');
      }
    } catch (Exception) {
      // Sem os títulos o app ainda sabe quem usa o microfone.
    }
    return sb.Append("]}").ToString();
  }

  [STAThread]
  static int Main(string[] args) {
    double seconds = 2;
    if (args.Length > 0) double.TryParse(args[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out seconds);
    int ms = (int)Math.Max(500, seconds * 1000);
    uint self = (uint)System.Diagnostics.Process.GetCurrentProcess().Id;
    Proc me;
    uint parent = Processes().TryGetValue(self, out me) ? me.Parent : 0;
    while (true) {
      var procs = Processes();
      // No Windows escrever num pipe fechado não dá erro: quem avisa que o app fechou é o processo pai sumir.
      if (parent != 0 && procs.Count > 0 && !procs.ContainsKey(parent)) return 0;
      string line;
      try {
        line = Report(procs);
      } catch (Exception) {
        line = "{\"apps\":[]}";
      }
      try {
        Console.Out.WriteLine(line);
        Console.Out.Flush();
      } catch (Exception) {
        return 0;
      }
      Thread.Sleep(ms);
    }
  }
}
