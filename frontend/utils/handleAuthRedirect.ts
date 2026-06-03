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
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      })
    );
  } catch {
    // no-op
  }
}


