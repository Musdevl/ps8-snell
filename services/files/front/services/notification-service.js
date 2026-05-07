export function notify(message, type = 'info', data, duration) {
    window.dispatchEvent(new CustomEvent('notify', { detail: { message, type, data, duration } }));
}