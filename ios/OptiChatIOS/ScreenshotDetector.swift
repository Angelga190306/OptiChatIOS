import Foundation
import UIKit
import React

@objc(ScreenshotDetector)
class ScreenshotDetector: RCTEventEmitter {

  private var observer: NSObjectProtocol?

  override init() {
    super.init()
    setupNotificationObserver()
  }

  func setupNotificationObserver() {
    observer = NotificationCenter.default.addObserver(
      forName: UIApplication.userDidTakeScreenshotNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.sendEvent(withName: "onScreenshotTaken", body: [:])
    }
  }

  override func supportedEvents() -> [String]! {
    return ["onScreenshotTaken"]
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  deinit {
    if let observer = observer {
      NotificationCenter.default.removeObserver(observer)
    }
  }
}
