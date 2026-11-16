import ExpoModulesCore
import HealthKit

/// A treadmill session to save in Apple Health. Times in milliseconds since 1970.
struct WorkoutRecord: Record {
  @Field var startMs: Double = 0
  @Field var endMs: Double = 0
  @Field var distanceM: Double = 0
  @Field var steps: Double = 0
  @Field var running: Bool = false
  /// `[timeMs, beatsPerMinute]` pairs from a heart rate sensor.
  @Field var heartRates: [[Double]] = []
}

/// Apple Health: sessions saved as indoor walks or runs, heart rate and steps read back.
public class TapirouteHealthModule: Module {
  private let store = HKHealthStore()

  private var heartRate: HKQuantityType { HKQuantityType(.heartRate) }
  private var steps: HKQuantityType { HKQuantityType(.stepCount) }
  private var distance: HKQuantityType { HKQuantityType(.distanceWalkingRunning) }
  private let bpm = HKUnit.count().unitDivided(by: .minute())

  public func definition() -> ModuleDefinition {
    Name("TapirouteHealth")

    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    /// Asks once what Tapiroute may write (workouts, distance, steps, heart rate) and read.
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve(false)
        return
      }
      let write: Set<HKSampleType> = [HKObjectType.workoutType(), self.distance, self.steps, self.heartRate]
      let read: Set<HKObjectType> = [self.heartRate, self.steps]
      self.store.requestAuthorization(toShare: write, read: read) { ok, _ in
        promise.resolve(ok)
      }
    }

    AsyncFunction("saveWorkout") { (workout: WorkoutRecord, promise: Promise) in
      let start = Date(timeIntervalSince1970: workout.startMs / 1000)
      let end = Date(timeIntervalSince1970: max(workout.endMs, workout.startMs + 1000) / 1000)
      let configuration = HKWorkoutConfiguration()
      configuration.activityType = workout.running ? .running : .walking
      configuration.locationType = .indoor
      let builder = HKWorkoutBuilder(healthStore: self.store, configuration: configuration, device: .local())

      var samples: [HKSample] = [
        HKQuantitySample(
          type: self.distance,
          quantity: HKQuantity(unit: .meter(), doubleValue: workout.distanceM),
          start: start, end: end)
      ]
      if workout.steps > 0 {
        samples.append(HKQuantitySample(
          type: self.steps,
          quantity: HKQuantity(unit: .count(), doubleValue: workout.steps),
          start: start, end: end))
      }
      for pair in workout.heartRates where pair.count == 2 {
        let at = Date(timeIntervalSince1970: pair[0] / 1000)
        samples.append(HKQuantitySample(
          type: self.heartRate,
          quantity: HKQuantity(unit: self.bpm, doubleValue: pair[1]),
          start: at, end: at))
      }

      builder.beginCollection(withStart: start) { began, error in
        guard began else {
          promise.reject("ERR_HEALTH", error?.localizedDescription ?? "cannot start the workout")
          return
        }
        builder.add(samples) { _, _ in
          builder.addMetadata([HKMetadataKeyIndoorWorkout: true]) { _, _ in
            builder.endCollection(withEnd: end) { _, _ in
              builder.finishWorkout { saved, error in
                if saved != nil {
                  promise.resolve(true)
                } else {
                  promise.reject("ERR_HEALTH", error?.localizedDescription ?? "cannot save the workout")
                }
              }
            }
          }
        }
      }
    }

    /// Average and highest heart rate between two times (a watch's, for the summary).
    AsyncFunction("heartRateBetween") { (startMs: Double, endMs: Double, promise: Promise) in
      let predicate = HKQuery.predicateForSamples(
        withStart: Date(timeIntervalSince1970: startMs / 1000),
        end: Date(timeIntervalSince1970: endMs / 1000))
      let query = HKStatisticsQuery(
        quantityType: self.heartRate, quantitySamplePredicate: predicate,
        options: [.discreteAverage, .discreteMax]
      ) { _, statistics, _ in
        guard let average = statistics?.averageQuantity(), let highest = statistics?.maximumQuantity() else {
          promise.resolve(nil)
          return
        }
        promise.resolve([
          "average": average.doubleValue(for: self.bpm),
          "max": highest.doubleValue(for: self.bpm),
        ])
      }
      self.store.execute(query)
    }

    /// Steps since midnight from every source (iPhone, watch, Tapiroute).
    AsyncFunction("stepsToday") { (promise: Promise) in
      let start = Calendar.current.startOfDay(for: Date())
      let predicate = HKQuery.predicateForSamples(withStart: start, end: Date())
      let query = HKStatisticsQuery(
        quantityType: self.steps, quantitySamplePredicate: predicate, options: .cumulativeSum
      ) { _, statistics, _ in
        promise.resolve(statistics?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
      }
      self.store.execute(query)
    }
  }
}
