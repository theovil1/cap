Pod::Spec.new do |s|
  s.name           = 'TapirouteMusic'
  s.version        = '1.0.0'
  s.summary        = 'Apple Music and Spotify controls during a Tapiroute session'
  s.description    = 'Now playing and play, pause, next and previous for Apple Music (system player) and Spotify (App Remote).'
  s.author         = 'Tapiroute'
  s.homepage       = 'https://github.com/theovil1/tapiroute'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MediaPlayer'

  # Spotify's iOS SDK, as a Swift package (a binary framework).
  spm_dependency(s,
    url: 'https://github.com/spotify/ios-sdk.git',
    requirement: { kind: 'exactVersion', version: '5.0.1' },
    products: ['SpotifyiOS']
  )

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
