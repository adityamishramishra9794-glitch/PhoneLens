async function searchPhoneNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/[^\d+]/g, "");

  if (!cleaned) {
    return {
      phoneNumber,
      results: [],
      message: "Invalid phone number"
    };
  }

  return {
    phoneNumber: cleaned,
    results: [
      {
        type: "input",
        value: cleaned
      }
    ],
    message: "Phone number received successfully"
  };
}

module.exports = {
  searchPhoneNumber
};
