// micwatch: diz quais apps estão usando o microfone agora (macOS 14+).
// Imprime uma linha JSON sempre que a lista muda, por exemplo:
// {"apps":[{"bundleId":"com.microsoft.teams2","pid":123}]}
// Não grava nem lê áudio; só consulta o estado dos processos no CoreAudio.

import CoreAudio
import Foundation

func readProperty<T: BinaryInteger>(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector, _ initial: T) -> T? {
    var address = AudioObjectPropertyAddress(
        mSelector: selector,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var value = initial
    var size = UInt32(MemoryLayout<T>.size)
    let status = AudioObjectGetPropertyData(object, &address, 0, nil, &size, &value)
    return status == noErr ? value : nil
}

func processObjects() -> [AudioObjectID] {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyProcessObjectList,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var size: UInt32 = 0
    let system = AudioObjectID(kAudioObjectSystemObject)
    guard AudioObjectGetPropertyDataSize(system, &address, 0, nil, &size) == noErr, size > 0 else { return [] }
    var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
    guard AudioObjectGetPropertyData(system, &address, 0, nil, &size, &ids) == noErr else { return [] }
    return ids
}

func bundleId(_ process: AudioObjectID) -> String? {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioProcessPropertyBundleID,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var value: Unmanaged<CFString>? = nil
    var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    guard AudioObjectGetPropertyData(process, &address, 0, nil, &size, &value) == noErr,
          let cf = value?.takeRetainedValue() else { return nil }
    let s = cf as String
    return s.isEmpty ? nil : s
}

struct App: Codable, Hashable { let bundleId: String; let pid: Int32 }
struct Report: Codable { let apps: [App] }

func snapshot() -> [App] {
    var result = Set<App>()
    for process in processObjects() {
        let running: UInt32 = readProperty(process, kAudioProcessPropertyIsRunningInput, UInt32(0)) ?? 0
        guard running != 0, let id = bundleId(process) else { continue }
        let pid: pid_t = readProperty(process, kAudioProcessPropertyPID, pid_t(0)) ?? 0
        result.insert(App(bundleId: id, pid: pid))
    }
    return result.sorted { $0.bundleId < $1.bundleId }
}

let interval = CommandLine.arguments.count > 1 ? Double(CommandLine.arguments[1]) ?? 2 : 2
let encoder = JSONEncoder()
var last: [App]? = nil
setvbuf(stdout, nil, _IOLBF, 0)

while true {
    let now = snapshot()
    if now != last, let data = try? encoder.encode(Report(apps: now)), let line = String(data: data, encoding: .utf8) {
        print(line)
        last = now
    }
    Thread.sleep(forTimeInterval: interval)
}
