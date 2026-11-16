import ExpoModulesCore
import MediaPlayer

/// Music during a session: what plays in Apple Music or Spotify, and its controls.
public class TapirouteMusicModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TapirouteMusic")

    Events("onChange")

    OnStartObserving {
      AppleMusic.shared.onChange = { [weak self] track in self?.sendEvent("onChange", track) }
      SpotifyRemote.shared.onChange = { [weak self] track in self?.sendEvent("onChange", track) }
    }

    OnStopObserving {
      AppleMusic.shared.onChange = nil
      SpotifyRemote.shared.onChange = nil
    }

    /// Asks once for the music library, needed to read Apple Music's current track.
    AsyncFunction("requestAppleMusic") { (promise: Promise) in
      MPMediaLibrary.requestAuthorization { status in
        promise.resolve(status == .authorized)
      }
    }

    AsyncFunction("start") { (source: String) in
      if source == "apple" {
        SpotifyRemote.shared.stop()
        AppleMusic.shared.start()
      } else if source == "spotify" {
        AppleMusic.shared.stop()
        SpotifyRemote.shared.start()
      }
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      AppleMusic.shared.stop()
      SpotifyRemote.shared.stop()
    }.runOnQueue(.main)

    AsyncFunction("command") { (source: String, name: String) in
      if source == "apple" {
        AppleMusic.shared.command(name)
      } else if source == "spotify" {
        SpotifyRemote.shared.command(name)
      }
    }.runOnQueue(.main)

    /// Whether this build knows a Spotify client id.
    Function("spotifyReady") { () -> Bool in
      let id = Bundle.main.object(forInfoDictionaryKey: "TapirouteSpotifyClientID") as? String
      return !(id ?? "").isEmpty
    }
  }
}
