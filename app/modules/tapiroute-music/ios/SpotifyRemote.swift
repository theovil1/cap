import SpotifyiOS
import UIKit

/// Spotify's App Remote: the Spotify app plays, Tapiroute shows and drives it.
final class SpotifyRemote: NSObject, SPTAppRemoteDelegate, SPTAppRemotePlayerStateDelegate {
  static let shared = SpotifyRemote()

  /// Where Spotify sends the walker back after they allow Tapiroute.
  static let redirect = URL(string: "cap://spotify-auth")!
  private static let tokenKey = "tapirouteSpotifyToken"

  var onChange: (([String: Any]) -> Void)?

  private lazy var remote: SPTAppRemote? = {
    guard let clientID = Bundle.main.object(forInfoDictionaryKey: "TapirouteSpotifyClientID") as? String,
          !clientID.isEmpty else { return nil }
    let configuration = SPTConfiguration(clientID: clientID, redirectURL: Self.redirect)
    let remote = SPTAppRemote(configuration: configuration, logLevel: .error)
    remote.delegate = self
    return remote
  }()

  /// Whether the walker wants Spotify: reconnect when the app comes back.
  private var wanted = false

  /// Connects with the token kept from last time, else asks Spotify (a trip to its app).
  func start() {
    guard let remote else {
      emitState(connected: false)
      return
    }
    wanted = true
    if remote.isConnected {
      remote.playerAPI?.getPlayerState { [weak self] result, _ in
        if let state = result as? SPTAppRemotePlayerState { self?.emit(state) }
      }
      return
    }
    if let token = UserDefaults.standard.string(forKey: Self.tokenKey) {
      remote.connectionParameters.accessToken = token
      remote.connect()
    } else {
      authorize()
    }
  }

  func stop() {
    wanted = false
    remote?.disconnect()
  }

  func authorize() {
    remote?.authorizeAndPlayURI("", completionHandler: nil)
  }

  /// The way back from Spotify, with a token when the walker said yes.
  func handle(_ url: URL) -> Bool {
    guard url.scheme == Self.redirect.scheme, url.host == Self.redirect.host, let remote else { return false }
    if let token = remote.authorizationParameters(from: url)?[SPTAppRemoteAccessTokenKey] {
      UserDefaults.standard.set(token, forKey: Self.tokenKey)
      remote.connectionParameters.accessToken = token
      remote.connect()
    }
    return true
  }

  func becameActive() {
    if wanted, let remote, !remote.isConnected, remote.connectionParameters.accessToken != nil {
      remote.connect()
    }
  }

  func resignedActive() {
    remote?.disconnect()
  }

  func command(_ name: String) {
    guard let player = remote?.playerAPI else { return }
    switch name {
    case "play": player.resume(nil)
    case "pause": player.pause(nil)
    case "next": player.skip(toNext: nil)
    case "previous": player.skip(toPrevious: nil)
    default: break
    }
  }

  // MARK: SPTAppRemoteDelegate

  func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
    appRemote.playerAPI?.delegate = self
    appRemote.playerAPI?.subscribe(toPlayerState: nil)
    appRemote.playerAPI?.getPlayerState { [weak self] result, _ in
      if let state = result as? SPTAppRemotePlayerState { self?.emit(state) }
    }
  }

  func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: Error?) {
    // An old token: forget it, the next start asks Spotify again.
    UserDefaults.standard.removeObject(forKey: Self.tokenKey)
    emitState(connected: false)
  }

  func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: Error?) {
    emitState(connected: false)
  }

  // MARK: SPTAppRemotePlayerStateDelegate

  func playerStateDidChange(_ playerState: SPTAppRemotePlayerState) {
    emit(playerState)
  }

  private func emitState(connected: Bool) {
    onChange?(["source": "spotify", "connected": connected, "playing": false, "title": "", "artist": ""])
  }

  private func emit(_ state: SPTAppRemotePlayerState) {
    var track: [String: Any] = [
      "source": "spotify",
      "connected": true,
      "playing": !state.isPaused,
      "title": state.track.name,
      "artist": state.track.artist.name,
    ]
    onChange?(track)
    remote?.imageAPI?.fetchImage(forItem: state.track, with: CGSize(width: 120, height: 120)) { [weak self] result, _ in
      guard let image = result as? UIImage, let data = image.jpegData(compressionQuality: 0.7) else { return }
      track["artwork"] = "data:image/jpeg;base64," + data.base64EncodedString()
      self?.onChange?(track)
    }
  }
}
