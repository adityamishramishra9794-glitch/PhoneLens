async function searchPhoneNumber(phoneNumber) {
  return {
    phoneNumber,
    results: [],
    message: "Search engine is ready"
  };
}

module.exports = {
  searchPhoneNumber
};
