Pod::Spec.new do |s|
  s.name           = 'TapirouteHealth'
  s.version        = '1.0.0'
  s.summary        = 'Apple Health for Tapiroute sessions'
  s.description    = 'Saves sessions as workouts and reads heart rate and the day\'s steps from HealthKit.'
  s.author         = 'Tapiroute'
  s.homepage       = 'https://github.com/theovil1/tapiroute'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
