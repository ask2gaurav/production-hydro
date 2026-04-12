import { createContext, useContext, useState, ReactNode } from 'react'
import { useEsp32Discovery, UseEsp32DiscoveryReturn } from '../hooks/useEsp32Discovery'

interface DeviceContextValue extends UseEsp32DiscoveryReturn {
    manualIp: string
    setManualIp: (ip: string) => void
    effectiveIp: string | null
    deviceUrl: (path?: string) => string | null
}

const DeviceContext = createContext<DeviceContextValue | null>(null)

interface DeviceProviderProps {
    children: ReactNode
}

export function DeviceProvider({ children }: DeviceProviderProps) {
    const discovery = useEsp32Discovery()
    const [manualIp, setManualIp] = useState<string>('')

    const effectiveIp: string | null = manualIp || discovery.deviceIp

    const deviceUrl = (path: string = ''): string | null =>
        effectiveIp ? `http://${effectiveIp}${path}` : null

    return (
        <DeviceContext.Provider value={{ ...discovery, manualIp, setManualIp, effectiveIp, deviceUrl }}>
            {children}
        </DeviceContext.Provider>
    )
}

export function useDevice(): DeviceContextValue {
    const ctx = useContext(DeviceContext)
    if (!ctx) throw new Error('useDevice must be used inside <DeviceProvider>')
    return ctx
}