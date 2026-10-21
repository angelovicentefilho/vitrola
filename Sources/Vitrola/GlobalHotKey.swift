import Carbon

/// Atalho de teclado global (funciona com qualquer app em primeiro plano).
/// Usa a API de hot keys do Carbon, que não exige permissão de Acessibilidade.
final class GlobalHotKey {
    private var hotKeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?
    private let action: () -> Void

    init?(keyCode: UInt32, modifiers: UInt32, id: UInt32, action: @escaping () -> Void) {
        self.action = action

        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard),
                                 eventKind: UInt32(kEventHotKeyPressed))
        let selfPointer = Unmanaged.passUnretained(self).toOpaque()
        let installed = InstallEventHandler(GetApplicationEventTarget(), { _, _, userData in
            guard let userData else { return OSStatus(0) }
            let hotKey = Unmanaged<GlobalHotKey>.fromOpaque(userData).takeUnretainedValue()
            hotKey.action()
            return OSStatus(0)
        }, 1, &spec, selfPointer, &handlerRef)
        guard installed == 0 else { return nil }

        let hotKeyID = EventHotKeyID(signature: OSType(0x5654_524C), id: id)   // 'VTRL'
        let registered = RegisterEventHotKey(keyCode, modifiers, hotKeyID,
                                             GetApplicationEventTarget(), 0, &hotKeyRef)
        guard registered == 0 else {
            if let handlerRef { RemoveEventHandler(handlerRef) }
            return nil
        }
    }

    deinit {
        if let hotKeyRef { UnregisterEventHotKey(hotKeyRef) }
        if let handlerRef { RemoveEventHandler(handlerRef) }
    }
}
