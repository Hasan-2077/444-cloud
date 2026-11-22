'use strict';

function statusForResult(result) {
  if (
    !result ||
    !result.state
  ) {
    return {
      httpStatus: 500,
      title: 'Email failed',
      message:
        'The email service did not return a usable status.'
    };
  }

  if (
    result.state === 'sent'
  ) {
    return {
      httpStatus: 200,
      title: 'Email sent',
      message:
        'The email service accepted the report for delivery.'
    };
  }

  if (
    result.state ===
    'pending_confirmation'
  ) {
    return {
      httpStatus: 202,
      title:
        'Email confirmation required',
      message:
        'A verification message has been sent. Confirm the address, then send the report again.'
    };
  }

  if (
    result.state === 'disabled'
  ) {
    return {
      httpStatus: 503,
      title:
        'Email unavailable',
      message:
        'Email delivery is not configured on this environment.'
    };
  }

  if (
    result.state ===
    'limit_reached'
  ) {
    return {
      httpStatus: 429,
      title:
        'Email limit reached',
      message:
        'Too many email requests were made from this visitor. Please try again later.'
    };
  }

  return {
    httpStatus: 503,
    title:
      'Email failed',
    message:
      'The email service is temporarily unavailable. The report was not claimed as sent.'
  };
}

module.exports = {
  statusForResult:
    statusForResult
};
