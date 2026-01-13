// React shim for email templates
// This file ensures React is available globally for email template rendering
if (typeof React === "undefined") {
  global.React = require("react");
}
