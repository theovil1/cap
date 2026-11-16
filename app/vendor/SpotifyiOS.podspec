# Spotify's iOS SDK is a dynamic framework: as a vendored framework, CocoaPods
# embeds it in the app (a Swift package linked through a pod was not embedded,
# and the app stopped at launch).
Pod::Spec.new do |s|
  s.name         = 'SpotifyiOS'
  s.version      = '5.0.1'
  s.summary      = 'Spotify iOS SDK (App Remote)'
  s.homepage     = 'https://github.com/spotify/ios-sdk'
  s.license      = { type: 'Commercial', text: 'See https://developer.spotify.com/terms' }
  s.author       = 'Spotify'
  s.platforms    = { :ios => '12.0' }
  s.source       = { http: 'https://github.com/spotify/ios-sdk/archive/refs/tags/v5.0.1.zip' }
  s.vendored_frameworks = 'ios-sdk-5.0.1/SpotifyiOS.xcframework'
end
