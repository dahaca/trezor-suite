import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import * as LocalAuthentication from 'expo-local-authentication';

import { getIsBiometricsFeatureAvailable } from './isBiometricsFeatureAvailable';
import {
    useIsBiometricsEnabled,
    useIsBiometricsOverlayVisible,
    useIsUserAuthenticated,
} from './biometricsAtoms';

/**
 * The time period for which is user not asked to be authenticated again if returns back to the app.
 */
const KEEP_LOGGED_IN_TIMEOUT = 30_000;

export const authenticate = async () => {
    const isBiometricsAvailable = await getIsBiometricsFeatureAvailable();

    if (isBiometricsAvailable) {
        const result = await LocalAuthentication.authenticateAsync();
        return result;
    }
};

export const useBiometrics = () => {
    const { isBiometricsOptionEnabled } = useIsBiometricsEnabled();
    const { isUserAuthenticated, setIsUserAuthenticated } = useIsUserAuthenticated();
    const { setIsBiometricsOverlayVisible } = useIsBiometricsOverlayVisible();
    const appState = useRef(AppState.currentState);
    const goneToBackgroundAtTimestamp = useRef<null | number>(null);

    const handleAuthentication = useCallback(async () => {
        if (isBiometricsOptionEnabled && !isUserAuthenticated) {
            const result = await authenticate();

            if (result && result?.success) {
                setIsUserAuthenticated(true);
                setIsBiometricsOverlayVisible(false);
            } else {
                handleAuthentication();
            }
        }
    }, [
        isBiometricsOptionEnabled,
        isUserAuthenticated,
        setIsUserAuthenticated,
        setIsBiometricsOverlayVisible,
    ]);

    // Monitors AppState and adjust the authentication state accordingly.
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            switch (nextAppState) {
                case 'active':
                    if (
                        // Revoke user authentication if the timeout has run out.
                        appState.current === 'background' &&
                        goneToBackgroundAtTimestamp.current &&
                        goneToBackgroundAtTimestamp.current < Date.now() - KEEP_LOGGED_IN_TIMEOUT
                    ) {
                        setIsUserAuthenticated(false);
                    } else if (isUserAuthenticated) {
                        setIsBiometricsOverlayVisible(false);
                    }

                    break;

                case 'background':
                    setIsBiometricsOverlayVisible(true);
                    goneToBackgroundAtTimestamp.current = Date.now();
                    break;

                case 'inactive':
                    setIsBiometricsOverlayVisible(true);
                    break;

                default:
                    return;
            }

            appState.current = nextAppState;
        });

        return () => subscription.remove();
    }, [
        isBiometricsOptionEnabled,
        setIsUserAuthenticated,
        setIsBiometricsOverlayVisible,
        isUserAuthenticated,
    ]);

    // Ask the user for an authentication whenever the authentication state changes.
    useEffect(() => {
        const auth = async () => {
            await handleAuthentication();
        };

        auth();
        // Only run once on app start from killed state
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isUserAuthenticated, isBiometricsOptionEnabled]);
};