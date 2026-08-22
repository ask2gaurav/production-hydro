import { EspUsb } from '../plugins/espUsb';
import { addLog } from './debugLog';

// Tracks the live USB-serial link to the ESP32 and brokers the strictly 1:1
// "write a line, read the next line back" protocol over that link. See the USB
// connection plan for the wire format: app writes the same query string the HTTP
// endpoint accepts, ESP32 replies with the same loose-JSON line machineinfo.html returns.

let connected = false;

// A transient failure right after connecting is expected — opening the port commonly
// resets the ESP32 (DTR/RTS toggle), and it can't answer for a few seconds while it
// reboots/reconnects WiFi. Only give up on USB after several failures in a row.
const USB_FAILURE_TOLERANCE = 3;
let consecutiveFailures = 0;

interface PendingRequest {
  resolve: (line: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let pending: PendingRequest | null = null;

function failPending(err: Error) {
  if (!pending) return;
  clearTimeout(pending.timer);
  const { reject } = pending;
  pending = null;
  reject(err);
}

EspUsb.addListener('usbConnected', () => {
  connected = true;
  consecutiveFailures = 0;
});

EspUsb.addListener('usbDisconnected', () => {
  connected = false;
  failPending(new Error('USB disconnected'));
});

EspUsb.addListener('usbDataReceived', ({ line }) => {
  if (!pending) return;
  clearTimeout(pending.timer);
  const { resolve } = pending;
  pending = null;
  resolve(line);
});

export function isUsbActive(): boolean {
  return connected;
}

/**
 * Records a USB write/read failure (timeout or write error). The current call always
 * falls back to WiFi regardless (see transportSend in nativeHttp.ts), but the USB link
 * itself is only torn down after USB_FAILURE_TOLERANCE consecutive failures — a single
 * timeout is expected right after connecting (see the comment above) and shouldn't force
 * every subsequent call onto WiFi for the rest of the session.
 */
export function markUsbFailed(reason: string): void {
  if (!connected) return;
  failPending(new Error(reason));

  consecutiveFailures++;
  if (consecutiveFailures < USB_FAILURE_TOLERANCE) {
    addLog({ type: 'info', message: `USB request failed (${consecutiveFailures}/${USB_FAILURE_TOLERANCE}): ${reason}` });
    return;
  }

  connected = false;
  void EspUsb.disconnect().catch(() => {});
}

// USB is a single physical serial line — only one request may be in flight at a time.
// Overlapping callers (e.g. a slow/timing-out poll still in flight when the next poll
// tick fires, a user action firing a command mid-poll, or — since Ionic keeps previous
// page instances mounted for its back-navigation transitions — more than one Therapy
// page polling in the background at once) are queued and run one after another instead
// of erroring out; erroring here previously burned through the failure-tolerance budget
// in about a second and force-disconnected USB even though the link itself was fine.
let requestQueue: Promise<void> = Promise.resolve();

export function sendLine(
  query: string,
  timeoutMs: number,
  logType: 'poll' | 'command' = 'poll'
): Promise<string> {
  const result = requestQueue.then(() => sendLineExclusive(query, timeoutMs, logType));
  requestQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Writes `query` as one line over USB and resolves with the next line the ESP32
 * sends back. Only called with the exclusivity `sendLine`'s queue guarantees, so
 * there is never more than one exchange in flight at once.
 */
async function sendLineExclusive(
  query: string,
  timeoutMs: number,
  logType: 'poll' | 'command',
): Promise<string> {
  if (!connected) throw new Error('USB not connected');

  try {
    const line = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending?.resolve === resolve) {
          pending = null;
          reject(new Error('USB request timed out'));
        }
      }, timeoutMs);
      pending = { resolve, reject, timer };

      EspUsb.writeLine({ data: query }).catch((e: unknown) => {
        if (pending?.resolve === resolve) {
          clearTimeout(pending.timer);
          pending = null;
        }
        reject(e instanceof Error ? e : new Error(String(e)));
      });
    });

    consecutiveFailures = 0;
    addLog({ type: logType, url: `usb:${query}`, status: 'ok', body: line });
    return line;
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    addLog({ type: logType, url: `usb:${query}`, status: 'error', error: err.message });
    throw err;
  }
}
