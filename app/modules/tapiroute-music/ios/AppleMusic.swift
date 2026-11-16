import MediaPlayer
import UIKit

/// The Music app's player, as iOS lets other apps see and drive it.
final class AppleMusic {
  static let shared = AppleMusic()

  /// Called with the current track each time it or the playback state changes.
  var onChange: (([String: Any]) -> Void)?

  private let player = MPMusicPlayerController.systemMusicPlayer
  private var observers: [NSObjectProtocol] = []

  func start() {
    guard observers.isEmpty else {
      emit()
      return
    }
    player.beginGeneratingPlaybackNotifications()
    let center = NotificationCenter.default
    for name in [
      Notification.Name.MPMusicPlayerControllerNowPlayingItemDidChange,
      Notification.Name.MPMusicPlayerControllerPlaybackStateDidChange,
    ] {
      observers.append(center.addObserver(forName: name, object: player, queue: .main) { [weak self] _ in
        self?.emit()
      })
    }
    emit()
  }

  func stop() {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
    player.endGeneratingPlaybackNotifications()
  }

  func command(_ name: String) {
    switch name {
    case "play": player.play()
    case "pause": player.pause()
    case "next": player.skipToNextItem()
    case "previous": player.skipToPreviousItem()
    default: break
    }
  }

  private func emit() {
    let item = player.nowPlayingItem
    var track: [String: Any] = [
      "source": "apple",
      "connected": true,
      "playing": player.playbackState == .playing,
      "title": item?.title ?? "",
      "artist": item?.artist ?? "",
    ]
    if let image = item?.artwork?.image(at: CGSize(width: 120, height: 120)),
       let data = image.jpegData(compressionQuality: 0.7) {
      track["artwork"] = "data:image/jpeg;base64," + data.base64EncodedString()
    }
    onChange?(track)
  }
}
