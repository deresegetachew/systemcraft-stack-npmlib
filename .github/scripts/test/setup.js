const originalConsole = { ...console };
// console.log = console.info = console.warn = console.error = () => { };

// Optionally, allow opt-out for debugging:
if (process.env.VERBOSE_TESTS === 'true') {
    Object.assign(console, originalConsole);
}