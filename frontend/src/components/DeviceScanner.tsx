import { ChangeEvent } from 'react'
import { useDevice } from '../context/DeviceContext'

const SUBNETS: string[] = ['192.168.43', '192.168.1', '192.168.0']

export function DeviceScanner() {
    const {
        status, progress, deviceIp, subnet,
        setSubnet, scan, stop, reset,
        manualIp, setManualIp, effectiveIp,
    } = useDevice()

    return (
        <div style={{ padding: '1rem', maxWidth: 480 }}>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select
                    value={subnet}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setSubnet(e.target.value)}
                    disabled={status === 'scanning'}
                    style={{ flex: 1 }}
                >
                    {SUBNETS.map(s => (
                        <option key={s} value={s}>{s}.0/24</option>
                    ))}
                </select>
                {status !== 'scanning' ? (
                    <button onClick={() => scan()}>Scan</button>
                ) : (
                    <button onClick={stop}>Stop</button>
                )}
            </div>

            {status === 'scanning' && (
                <div style={{
                    height: 4, background: 'var(--color-border-tertiary)',
                    borderRadius: 2, marginBottom: 12, overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'var(--color-text-info)',
                        transition: 'width 0.2s',
                    }} />
                </div>
            )}

            {status === 'scanning' && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
                    Scanning {subnet}.1–254 · {progress}%
                </p>
            )}

            {status === 'found' && (
                <div style={{
                    padding: '10px 14px', borderRadius: 'var(--border-radius-md)',
                    background: 'var(--color-background-success)',
                    color: 'var(--color-text-success)', fontSize: 14,
                    marginBottom: 12, display: 'flex', justifyContent: 'space-between',
                }}>
                    <span>Found ESP32 at <strong>{deviceIp}</strong></span>
                    <button onClick={reset} style={{ fontSize: 12 }}>Clear</button>
                </div>
            )}

            {status === 'failed' && (
                <div style={{
                    padding: '10px 14px', borderRadius: 'var(--border-radius-md)',
                    background: 'var(--color-background-danger)',
                    color: 'var(--color-text-danger)', fontSize: 14, marginBottom: 12,
                }}>
                    No ESP32 found on {subnet}.x — try a different subnet or enter the IP manually below.
                </div>
            )}

            <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Or enter IP manually
                </label>
                <input
                    type="text"
                    placeholder="192.168.43.100"
                    value={manualIp}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setManualIp(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                />
            </div>

            {effectiveIp && (
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                    Active device: http://{effectiveIp}
                </p>
            )}

        </div>
    )
}