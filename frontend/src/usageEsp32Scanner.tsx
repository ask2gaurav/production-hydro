import { useDevice } from './context/DeviceContext'
import { useState } from 'react'
interface SensorData {
    temperature: number
    humidity: number
}
function SensorReadings() {
    const { deviceUrl, effectiveIp } = useDevice()
    const [data, setData] = useState<SensorData | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fetchSensor = async (): Promise<void> => {
        const url = deviceUrl('/sensor')
        if (!url) return
        try {
            const res = await fetch(url)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            setData(await res.json() as SensorData)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        }
    }

    return (
        <div>
            {!effectiveIp && <p>No device connected. Run a scan first.</p>}
            <button onClick={fetchSensor} disabled={!effectiveIp}>Read sensor</button>
            {error && <p style={{ color: 'var(--color-text-danger)' }}>{error}</p>}
            {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
        </div>
    )
}
export default SensorReadings;