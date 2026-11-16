import ExpoModulesCore
import UIKit

/// Takes Spotify's way back into the app and keeps its connection to the app's life.
public class TapirouteMusicAppDelegate: ExpoAppDelegateSubscriber {
  public func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return SpotifyRemote.shared.handle(url)
  }

  public func applicationDidBecomeActive(_ application: UIApplication) {
    SpotifyRemote.shared.becameActive()
  }

  public func applicationWillResignActive(_ application: UIApplication) {
    SpotifyRemote.shared.resignedActive()
  }
}
