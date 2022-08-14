const separator = (numb) => {
  var str = numb.toString().split(".");
  if (str.length > 1) {
    str[1] = str[1].padEnd(2, '0')
  } else {
    str[1] = '00'
  }
  str[0] = str[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return str.join(".");
}

module.exports = separator