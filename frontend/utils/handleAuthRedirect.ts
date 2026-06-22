import { CommonActions, NavigationContainerRef } from '@react-navigation/native';

/**
 * Force the app into the Auth stack.
 * RootNavigator chooses Auth vs Main based on AuthContext state.
 */
export function forceNavigateToLogin(
  navigationRef: React.RefObject<NavigationContainerRef<any>> | any
) {
  try {
    const navigation = navigationRef?.current;
    if (!navigation) return;

    // Reset to RootNavigator's Auth route. RootNavigator itself is mounted as the app root.
    // Deferring avoids a race condition where the current navigator hasn't switched state yet.
    setTimeout(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Auth' }],
        })
      );
    }, 0);
  } catch {
    // no-op
  }
}


