export { onPastEvent, onEvent }

function onPastEvent(source = "", eventLog) {
  const sourceLogging = source ? source + ": " : ""
  const eventLogging = `<pre>${eventLog}</pre>`

  $("#past-log-events").append("<li>" + sourceLogging + eventLogging + "</li>")
}
function onEvent(source = "", eventLog) {
  const sourceLogging = source ? source + ": " : ""
  const eventLogging = `<pre>${eventLog}</pre>`

  $("#log-events").append("<li>" + sourceLogging + eventLogging + "</li>")
}

// let notificationHasShown = false

// function hasNotification() {
//   if (notificationHasShown) return
//   else notificationHasShown = true

//   if (!("Notification" in window)) {
//     alert("This browser does not support desktop notification")
//     return false
//   } else if (Notification.permission === "granted") {
//     return true
//   } else if (Notification.permission !== "denied") {
//     Notification.requestPermission().then((permission) => {
//       if (permission === "granted") {
//         return true
//       }
//       return false
//     })
//   }
// }
