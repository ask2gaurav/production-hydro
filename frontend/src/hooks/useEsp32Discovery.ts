import { useState, useCallback, useRef } from 'react'

const DISCOVERY_ENDPOINT = '/discover'
const SCAN_TIMEOUT_MS = 800
const CONCURRENCY = 20
const SUBNETS = ['192.168.43', '192.168.1', '192.168.0'] as const

//type Subnet = typeof SUBNETS[number]

export type ScanStatus = 'idle' | 'scanning' | 'found' | 'failed'

export interface UseEsp32DiscoveryReturn {
    status: ScanStatus
    progress: number
    deviceIp: string | null
    subnet: string
    setSubnet: (subnet: string) => void
    scan: (customSubnet?: string) => Promise<void>
    stop: () => void
    reset: () => void
}

async function probeHost(ip: string, signal: AbortSignal): Promise<string | null> {
    try {
        const res = await fetch(`http://${ip}${DISCOVERY_ENDPOINT}`, {
            signal,
            mode: 'cors',
            cache: 'no-store',
        })
        if (!res.ok) return null
        const text = await res.text()
        return text.startsWith('ESP32:') ? ip : null
    } catch {
        return null
    }
}

async function scanSubnet(
    subnet: string,
    onProgress: (pct: number) => void,
    onFound: (ip: string) => void,
    signal: AbortSignal,
): Promise<void> {
    const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`)
    let completed = 0

    for (let i = 0; i < hosts.length; i += CONCURRENCY) {
        if (signal.aborted) break

        const batch = hosts.slice(i, i + CONCURRENCY)

        const controllers = batch.map(() => {
            const ac = new AbortController()
            const timer = setTimeout(() => ac.abort(), SCAN_TIMEOUT_MS)
            return { ac, timer }
        })

        const results = await Promise.all(
            batch.map((ip, idx) => probeHost(ip, controllers[idx].ac.signal))
        )

        controllers.forEach(({ timer }) => clearTimeout(timer))
        completed += batch.length
        onProgress(Math.round((completed / hosts.length) * 100))

        for (const ip of results) {
            if (ip) { onFound(ip); return }
        }
    }
}

export function useEsp32Discovery(): UseEsp32DiscoveryReturn {
    const [status, setStatus] = useState<ScanStatus>('idle')
    const [progress, setProgress] = useState<number>(0)
    const [deviceIp, setDeviceIp] = useState<string | null>(null)
    const [subnet, setSubnet] = useState<string>(SUBNETS[0])
    const abortRef = useRef<AbortController | null>(null)

    const scan = useCallback(async (customSubnet?: string): Promise<void> => {
        abortRef.current?.abort()
        const ac = new AbortController()
        abortRef.current = ac

        const target = customSubnet ?? subnet
        setStatus('scanning')
        setProgress(0)
        setDeviceIp(null)

        let found = false

        await scanSubnet(
            target,
            (pct) => setProgress(pct),
            (ip) => { found = true; setDeviceIp(ip); setStatus('found') },
            ac.signal,
        )

        if (!found && !ac.signal.aborted) setStatus('failed')
    }, [subnet])

    const stop = useCallback((): void => {
        abortRef.current?.abort()
        setStatus('idle')
    }, [])

    const reset = useCallback((): void => {
        abortRef.current?.abort()
        setStatus('idle')
        setProgress(0)
        setDeviceIp(null)
    }, [])

    return { status, progress, deviceIp, subnet, setSubnet, scan, stop, reset }
}