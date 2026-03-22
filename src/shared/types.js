/**
 * Shared types for config and IPC communication
 */
// Default configuration factory
export function createDefaultConfig() {
    return {
        activeProfileId: 'default',
        profiles: [
            {
                id: 'default',
                name: 'Default',
                tabs: [
                    {
                        id: 'example-1',
                        title: 'Example Site',
                        url: 'https://example.com',
                        allowedOrigins: ['https://example.com'],
                        icon: '🌐'
                    }
                ]
            }
        ]
    };
}
// IPC channel names
export const IPC_CHANNELS = {
    // Renderer -> Main
    SWITCH_TAB: 'switch-tab',
    RELOAD_TAB: 'reload-tab',
    CLOSE_TAB: 'close-tab',
    GET_CONFIG: 'get-config',
    UPDATE_CONFIG: 'update-config',
    OPEN_EXTERNAL: 'open-external',
    // Main -> Renderer
    TAB_UPDATED: 'tab-updated',
    NAVIGATION_BLOCKED: 'navigation-blocked',
    CONFIG_UPDATED: 'config-updated'
};
