(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\..\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\index.js","/..\\..\\..\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer")
},{"base64-js":2,"buffer":1,"htZkx4":4,"ieee754":3}],2:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\..\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\node_modules\\base64-js\\lib\\b64.js","/..\\..\\..\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\node_modules\\base64-js\\lib")
},{"buffer":1,"htZkx4":4}],3:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\..\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\node_modules\\ieee754\\index.js","/..\\..\\..\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\node_modules\\ieee754")
},{"buffer":1,"htZkx4":4}],4:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\..\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\process\\browser.js","/..\\..\\..\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\process")
},{"buffer":1,"htZkx4":4}],5:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/**
 * @license
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modern -o ./dist/lodash.js`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
;(function() {

  /** Used as a safe reference for `undefined` in pre ES5 environments */
  var undefined;

  /** Used to pool arrays and objects used internally */
  var arrayPool = [],
      objectPool = [];

  /** Used to generate unique IDs */
  var idCounter = 0;

  /** Used to prefix keys to avoid issues with `__proto__` and properties on `Object.prototype` */
  var keyPrefix = +new Date + '';

  /** Used as the size when optimizations are enabled for large arrays */
  var largeArraySize = 75;

  /** Used as the max size of the `arrayPool` and `objectPool` */
  var maxPoolSize = 40;

  /** Used to detect and test whitespace */
  var whitespace = (
    // whitespace
    ' \t\x0B\f\xA0\ufeff' +

    // line terminators
    '\n\r\u2028\u2029' +

    // unicode category "Zs" space separators
    '\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000'
  );

  /** Used to match empty string literals in compiled template source */
  var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

  /**
   * Used to match ES6 template delimiters
   * http://people.mozilla.org/~jorendorff/es6-draft.html#sec-literals-string-literals
   */
  var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

  /** Used to match regexp flags from their coerced string values */
  var reFlags = /\w*$/;

  /** Used to detected named functions */
  var reFuncName = /^\s*function[ \n\r\t]+\w/;

  /** Used to match "interpolate" template delimiters */
  var reInterpolate = /<%=([\s\S]+?)%>/g;

  /** Used to match leading whitespace and zeros to be removed */
  var reLeadingSpacesAndZeros = RegExp('^[' + whitespace + ']*0+(?=.$)');

  /** Used to ensure capturing order of template delimiters */
  var reNoMatch = /($^)/;

  /** Used to detect functions containing a `this` reference */
  var reThis = /\bthis\b/;

  /** Used to match unescaped characters in compiled string literals */
  var reUnescapedString = /['\n\r\t\u2028\u2029\\]/g;

  /** Used to assign default `context` object properties */
  var contextProps = [
    'Array', 'Boolean', 'Date', 'Function', 'Math', 'Number', 'Object',
    'RegExp', 'String', '_', 'attachEvent', 'clearTimeout', 'isFinite', 'isNaN',
    'parseInt', 'setTimeout'
  ];

  /** Used to make template sourceURLs easier to identify */
  var templateCounter = 0;

  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /** Used to identify object classifications that `_.clone` supports */
  var cloneableClasses = {};
  cloneableClasses[funcClass] = false;
  cloneableClasses[argsClass] = cloneableClasses[arrayClass] =
  cloneableClasses[boolClass] = cloneableClasses[dateClass] =
  cloneableClasses[numberClass] = cloneableClasses[objectClass] =
  cloneableClasses[regexpClass] = cloneableClasses[stringClass] = true;

  /** Used as an internal `_.debounce` options object */
  var debounceOptions = {
    'leading': false,
    'maxWait': 0,
    'trailing': false
  };

  /** Used as the property descriptor for `__bindData__` */
  var descriptor = {
    'configurable': false,
    'enumerable': false,
    'value': null,
    'writable': false
  };

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used to escape characters for inclusion in compiled string literals */
  var stringEscapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\t': 't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /** Used as a reference to the global object */
  var root = (objectTypes[typeof window] && window) || this;

  /** Detect free variable `exports` */
  var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

  /** Detect free variable `module` */
  var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports` */
  var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;

  /** Detect free variable `global` from Node.js or Browserified code and use it as `root` */
  var freeGlobal = objectTypes[typeof global] && global;
  if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
    root = freeGlobal;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * The base implementation of `_.indexOf` without support for binary searches
   * or `fromIndex` constraints.
   *
   * @private
   * @param {Array} array The array to search.
   * @param {*} value The value to search for.
   * @param {number} [fromIndex=0] The index to search from.
   * @returns {number} Returns the index of the matched value or `-1`.
   */
  function baseIndexOf(array, value, fromIndex) {
    var index = (fromIndex || 0) - 1,
        length = array ? array.length : 0;

    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * An implementation of `_.contains` for cache objects that mimics the return
   * signature of `_.indexOf` by returning `0` if the value is found, else `-1`.
   *
   * @private
   * @param {Object} cache The cache object to inspect.
   * @param {*} value The value to search for.
   * @returns {number} Returns `0` if `value` is found, else `-1`.
   */
  function cacheIndexOf(cache, value) {
    var type = typeof value;
    cache = cache.cache;

    if (type == 'boolean' || value == null) {
      return cache[value] ? 0 : -1;
    }
    if (type != 'number' && type != 'string') {
      type = 'object';
    }
    var key = type == 'number' ? value : keyPrefix + value;
    cache = (cache = cache[type]) && cache[key];

    return type == 'object'
      ? (cache && baseIndexOf(cache, value) > -1 ? 0 : -1)
      : (cache ? 0 : -1);
  }

  /**
   * Adds a given value to the corresponding cache object.
   *
   * @private
   * @param {*} value The value to add to the cache.
   */
  function cachePush(value) {
    var cache = this.cache,
        type = typeof value;

    if (type == 'boolean' || value == null) {
      cache[value] = true;
    } else {
      if (type != 'number' && type != 'string') {
        type = 'object';
      }
      var key = type == 'number' ? value : keyPrefix + value,
          typeCache = cache[type] || (cache[type] = {});

      if (type == 'object') {
        (typeCache[key] || (typeCache[key] = [])).push(value);
      } else {
        typeCache[key] = true;
      }
    }
  }

  /**
   * Used by `_.max` and `_.min` as the default callback when a given
   * collection is a string value.
   *
   * @private
   * @param {string} value The character to inspect.
   * @returns {number} Returns the code unit of given character.
   */
  function charAtCallback(value) {
    return value.charCodeAt(0);
  }

  /**
   * Used by `sortBy` to compare transformed `collection` elements, stable sorting
   * them in ascending order.
   *
   * @private
   * @param {Object} a The object to compare to `b`.
   * @param {Object} b The object to compare to `a`.
   * @returns {number} Returns the sort order indicator of `1` or `-1`.
   */
  function compareAscending(a, b) {
    var ac = a.criteria,
        bc = b.criteria,
        index = -1,
        length = ac.length;

    while (++index < length) {
      var value = ac[index],
          other = bc[index];

      if (value !== other) {
        if (value > other || typeof value == 'undefined') {
          return 1;
        }
        if (value < other || typeof other == 'undefined') {
          return -1;
        }
      }
    }
    // Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
    // that causes it, under certain circumstances, to return the same value for
    // `a` and `b`. See https://github.com/jashkenas/underscore/pull/1247
    //
    // This also ensures a stable sort in V8 and other engines.
    // See http://code.google.com/p/v8/issues/detail?id=90
    return a.index - b.index;
  }

  /**
   * Creates a cache object to optimize linear searches of large arrays.
   *
   * @private
   * @param {Array} [array=[]] The array to search.
   * @returns {null|Object} Returns the cache object or `null` if caching should not be used.
   */
  function createCache(array) {
    var index = -1,
        length = array.length,
        first = array[0],
        mid = array[(length / 2) | 0],
        last = array[length - 1];

    if (first && typeof first == 'object' &&
        mid && typeof mid == 'object' && last && typeof last == 'object') {
      return false;
    }
    var cache = getObject();
    cache['false'] = cache['null'] = cache['true'] = cache['undefined'] = false;

    var result = getObject();
    result.array = array;
    result.cache = cache;
    result.push = cachePush;

    while (++index < length) {
      result.push(array[index]);
    }
    return result;
  }

  /**
   * Used by `template` to escape characters for inclusion in compiled
   * string literals.
   *
   * @private
   * @param {string} match The matched character to escape.
   * @returns {string} Returns the escaped character.
   */
  function escapeStringChar(match) {
    return '\\' + stringEscapes[match];
  }

  /**
   * Gets an array from the array pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Array} The array from the pool.
   */
  function getArray() {
    return arrayPool.pop() || [];
  }

  /**
   * Gets an object from the object pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Object} The object from the pool.
   */
  function getObject() {
    return objectPool.pop() || {
      'array': null,
      'cache': null,
      'criteria': null,
      'false': false,
      'index': 0,
      'null': false,
      'number': null,
      'object': null,
      'push': null,
      'string': null,
      'true': false,
      'undefined': false,
      'value': null
    };
  }

  /**
   * Releases the given array back to the array pool.
   *
   * @private
   * @param {Array} [array] The array to release.
   */
  function releaseArray(array) {
    array.length = 0;
    if (arrayPool.length < maxPoolSize) {
      arrayPool.push(array);
    }
  }

  /**
   * Releases the given object back to the object pool.
   *
   * @private
   * @param {Object} [object] The object to release.
   */
  function releaseObject(object) {
    var cache = object.cache;
    if (cache) {
      releaseObject(cache);
    }
    object.array = object.cache = object.criteria = object.object = object.number = object.string = object.value = null;
    if (objectPool.length < maxPoolSize) {
      objectPool.push(object);
    }
  }

  /**
   * Slices the `collection` from the `start` index up to, but not including,
   * the `end` index.
   *
   * Note: This function is used instead of `Array#slice` to support node lists
   * in IE < 9 and to ensure dense arrays are returned.
   *
   * @private
   * @param {Array|Object|string} collection The collection to slice.
   * @param {number} start The start index.
   * @param {number} end The end index.
   * @returns {Array} Returns the new array.
   */
  function slice(array, start, end) {
    start || (start = 0);
    if (typeof end == 'undefined') {
      end = array ? array.length : 0;
    }
    var index = -1,
        length = end - start || 0,
        result = Array(length < 0 ? 0 : length);

    while (++index < length) {
      result[index] = array[start + index];
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Create a new `lodash` function using the given context object.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} [context=root] The context object.
   * @returns {Function} Returns the `lodash` function.
   */
  function runInContext(context) {
    // Avoid issues with some ES3 environments that attempt to use values, named
    // after built-in constructors like `Object`, for the creation of literals.
    // ES5 clears this up by stating that literals must use built-in constructors.
    // See http://es5.github.io/#x11.1.5.
    context = context ? _.defaults(root.Object(), context, _.pick(root, contextProps)) : root;

    /** Native constructor references */
    var Array = context.Array,
        Boolean = context.Boolean,
        Date = context.Date,
        Function = context.Function,
        Math = context.Math,
        Number = context.Number,
        Object = context.Object,
        RegExp = context.RegExp,
        String = context.String,
        TypeError = context.TypeError;

    /**
     * Used for `Array` method references.
     *
     * Normally `Array.prototype` would suffice, however, using an array literal
     * avoids issues in Narwhal.
     */
    var arrayRef = [];

    /** Used for native method references */
    var objectProto = Object.prototype;

    /** Used to restore the original `_` reference in `noConflict` */
    var oldDash = context._;

    /** Used to resolve the internal [[Class]] of values */
    var toString = objectProto.toString;

    /** Used to detect if a method is native */
    var reNative = RegExp('^' +
      String(toString)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/toString| for [^\]]+/g, '.*?') + '$'
    );

    /** Native method shortcuts */
    var ceil = Math.ceil,
        clearTimeout = context.clearTimeout,
        floor = Math.floor,
        fnToString = Function.prototype.toString,
        getPrototypeOf = isNative(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
        hasOwnProperty = objectProto.hasOwnProperty,
        push = arrayRef.push,
        setTimeout = context.setTimeout,
        splice = arrayRef.splice,
        unshift = arrayRef.unshift;

    /** Used to set meta data on functions */
    var defineProperty = (function() {
      // IE 8 only accepts DOM elements
      try {
        var o = {},
            func = isNative(func = Object.defineProperty) && func,
            result = func(o, o, o) && func;
      } catch(e) { }
      return result;
    }());

    /* Native method shortcuts for methods with the same name as other `lodash` methods */
    var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate,
        nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray,
        nativeIsFinite = context.isFinite,
        nativeIsNaN = context.isNaN,
        nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys,
        nativeMax = Math.max,
        nativeMin = Math.min,
        nativeParseInt = context.parseInt,
        nativeRandom = Math.random;

    /** Used to lookup a built-in constructor by [[Class]] */
    var ctorByClass = {};
    ctorByClass[arrayClass] = Array;
    ctorByClass[boolClass] = Boolean;
    ctorByClass[dateClass] = Date;
    ctorByClass[funcClass] = Function;
    ctorByClass[objectClass] = Object;
    ctorByClass[numberClass] = Number;
    ctorByClass[regexpClass] = RegExp;
    ctorByClass[stringClass] = String;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object which wraps the given value to enable intuitive
     * method chaining.
     *
     * In addition to Lo-Dash methods, wrappers also have the following `Array` methods:
     * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
     * and `unshift`
     *
     * Chaining is supported in custom builds as long as the `value` method is
     * implicitly or explicitly included in the build.
     *
     * The chainable wrapper functions are:
     * `after`, `assign`, `bind`, `bindAll`, `bindKey`, `chain`, `compact`,
     * `compose`, `concat`, `countBy`, `create`, `createCallback`, `curry`,
     * `debounce`, `defaults`, `defer`, `delay`, `difference`, `filter`, `flatten`,
     * `forEach`, `forEachRight`, `forIn`, `forInRight`, `forOwn`, `forOwnRight`,
     * `functions`, `groupBy`, `indexBy`, `initial`, `intersection`, `invert`,
     * `invoke`, `keys`, `map`, `max`, `memoize`, `merge`, `min`, `object`, `omit`,
     * `once`, `pairs`, `partial`, `partialRight`, `pick`, `pluck`, `pull`, `push`,
     * `range`, `reject`, `remove`, `rest`, `reverse`, `shuffle`, `slice`, `sort`,
     * `sortBy`, `splice`, `tap`, `throttle`, `times`, `toArray`, `transform`,
     * `union`, `uniq`, `unshift`, `unzip`, `values`, `where`, `without`, `wrap`,
     * and `zip`
     *
     * The non-chainable wrapper functions are:
     * `clone`, `cloneDeep`, `contains`, `escape`, `every`, `find`, `findIndex`,
     * `findKey`, `findLast`, `findLastIndex`, `findLastKey`, `has`, `identity`,
     * `indexOf`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`,
     * `isEmpty`, `isEqual`, `isFinite`, `isFunction`, `isNaN`, `isNull`, `isNumber`,
     * `isObject`, `isPlainObject`, `isRegExp`, `isString`, `isUndefined`, `join`,
     * `lastIndexOf`, `mixin`, `noConflict`, `parseInt`, `pop`, `random`, `reduce`,
     * `reduceRight`, `result`, `shift`, `size`, `some`, `sortedIndex`, `runInContext`,
     * `template`, `unescape`, `uniqueId`, and `value`
     *
     * The wrapper functions `first` and `last` return wrapped values when `n` is
     * provided, otherwise they return unwrapped values.
     *
     * Explicit chaining can be enabled by using the `_.chain` method.
     *
     * @name _
     * @constructor
     * @category Chaining
     * @param {*} value The value to wrap in a `lodash` instance.
     * @returns {Object} Returns a `lodash` instance.
     * @example
     *
     * var wrapped = _([1, 2, 3]);
     *
     * // returns an unwrapped value
     * wrapped.reduce(function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * // returns a wrapped value
     * var squares = wrapped.map(function(num) {
     *   return num * num;
     * });
     *
     * _.isArray(squares);
     * // => false
     *
     * _.isArray(squares.value());
     * // => true
     */
    function lodash(value) {
      // don't wrap if already wrapped, even if wrapped by a different `lodash` constructor
      return (value && typeof value == 'object' && !isArray(value) && hasOwnProperty.call(value, '__wrapped__'))
       ? value
       : new lodashWrapper(value);
    }

    /**
     * A fast path for creating `lodash` wrapper objects.
     *
     * @private
     * @param {*} value The value to wrap in a `lodash` instance.
     * @param {boolean} chainAll A flag to enable chaining for all methods
     * @returns {Object} Returns a `lodash` instance.
     */
    function lodashWrapper(value, chainAll) {
      this.__chain__ = !!chainAll;
      this.__wrapped__ = value;
    }
    // ensure `new lodashWrapper` is an instance of `lodash`
    lodashWrapper.prototype = lodash.prototype;

    /**
     * An object used to flag environments features.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    var support = lodash.support = {};

    /**
     * Detect if functions can be decompiled by `Function#toString`
     * (all but PS3 and older Opera mobile browsers & avoided in Windows 8 apps).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcDecomp = !isNative(context.WinRTError) && reThis.test(runInContext);

    /**
     * Detect if `Function#name` is supported (all but IE).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcNames = typeof Function.name == 'string';

    /**
     * By default, the template delimiters used by Lo-Dash are similar to those in
     * embedded Ruby (ERB). Change the following template settings to use alternative
     * delimiters.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    lodash.templateSettings = {

      /**
       * Used to detect `data` property values to be HTML-escaped.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'escape': /<%-([\s\S]+?)%>/g,

      /**
       * Used to detect code to be evaluated.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'evaluate': /<%([\s\S]+?)%>/g,

      /**
       * Used to detect `data` property values to inject.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'interpolate': reInterpolate,

      /**
       * Used to reference the data object in the template text.
       *
       * @memberOf _.templateSettings
       * @type string
       */
      'variable': '',

      /**
       * Used to import variables into the compiled template.
       *
       * @memberOf _.templateSettings
       * @type Object
       */
      'imports': {

        /**
         * A reference to the `lodash` function.
         *
         * @memberOf _.templateSettings.imports
         * @type Function
         */
        '_': lodash
      }
    };

    /*--------------------------------------------------------------------------*/

    /**
     * The base implementation of `_.bind` that creates the bound function and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new bound function.
     */
    function baseBind(bindData) {
      var func = bindData[0],
          partialArgs = bindData[2],
          thisArg = bindData[4];

      function bound() {
        // `Function#bind` spec
        // http://es5.github.io/#x15.3.4.5
        if (partialArgs) {
          // avoid `arguments` object deoptimizations by using `slice` instead
          // of `Array.prototype.slice.call` and not assigning `arguments` to a
          // variable as a ternary expression
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        // mimic the constructor's `return` behavior
        // http://es5.github.io/#x13.2.2
        if (this instanceof bound) {
          // ensure `new bound` is an instance of `func`
          var thisBinding = baseCreate(func.prototype),
              result = func.apply(thisBinding, args || arguments);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisArg, args || arguments);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.clone` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates clones with source counterparts.
     * @returns {*} Returns the cloned value.
     */
    function baseClone(value, isDeep, callback, stackA, stackB) {
      if (callback) {
        var result = callback(value);
        if (typeof result != 'undefined') {
          return result;
        }
      }
      // inspect [[Class]]
      var isObj = isObject(value);
      if (isObj) {
        var className = toString.call(value);
        if (!cloneableClasses[className]) {
          return value;
        }
        var ctor = ctorByClass[className];
        switch (className) {
          case boolClass:
          case dateClass:
            return new ctor(+value);

          case numberClass:
          case stringClass:
            return new ctor(value);

          case regexpClass:
            result = ctor(value.source, reFlags.exec(value));
            result.lastIndex = value.lastIndex;
            return result;
        }
      } else {
        return value;
      }
      var isArr = isArray(value);
      if (isDeep) {
        // check for circular references and return corresponding clone
        var initedStack = !stackA;
        stackA || (stackA = getArray());
        stackB || (stackB = getArray());

        var length = stackA.length;
        while (length--) {
          if (stackA[length] == value) {
            return stackB[length];
          }
        }
        result = isArr ? ctor(value.length) : {};
      }
      else {
        result = isArr ? slice(value) : assign({}, value);
      }
      // add array properties assigned by `RegExp#exec`
      if (isArr) {
        if (hasOwnProperty.call(value, 'index')) {
          result.index = value.index;
        }
        if (hasOwnProperty.call(value, 'input')) {
          result.input = value.input;
        }
      }
      // exit for shallow clone
      if (!isDeep) {
        return result;
      }
      // add the source value to the stack of traversed objects
      // and associate it with its clone
      stackA.push(value);
      stackB.push(result);

      // recursively populate clone (susceptible to call stack limits)
      (isArr ? forEach : forOwn)(value, function(objValue, key) {
        result[key] = baseClone(objValue, isDeep, callback, stackA, stackB);
      });

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.create` without support for assigning
     * properties to the created object.
     *
     * @private
     * @param {Object} prototype The object to inherit from.
     * @returns {Object} Returns the new object.
     */
    function baseCreate(prototype, properties) {
      return isObject(prototype) ? nativeCreate(prototype) : {};
    }
    // fallback for browsers without `Object.create`
    if (!nativeCreate) {
      baseCreate = (function() {
        function Object() {}
        return function(prototype) {
          if (isObject(prototype)) {
            Object.prototype = prototype;
            var result = new Object;
            Object.prototype = null;
          }
          return result || context.Object();
        };
      }());
    }

    /**
     * The base implementation of `_.createCallback` without support for creating
     * "_.pluck" or "_.where" style callbacks.
     *
     * @private
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     */
    function baseCreateCallback(func, thisArg, argCount) {
      if (typeof func != 'function') {
        return identity;
      }
      // exit early for no `thisArg` or already bound by `Function#bind`
      if (typeof thisArg == 'undefined' || !('prototype' in func)) {
        return func;
      }
      var bindData = func.__bindData__;
      if (typeof bindData == 'undefined') {
        if (support.funcNames) {
          bindData = !func.name;
        }
        bindData = bindData || !support.funcDecomp;
        if (!bindData) {
          var source = fnToString.call(func);
          if (!support.funcNames) {
            bindData = !reFuncName.test(source);
          }
          if (!bindData) {
            // checks if `func` references the `this` keyword and stores the result
            bindData = reThis.test(source);
            setBindData(func, bindData);
          }
        }
      }
      // exit early if there are no `this` references or `func` is bound
      if (bindData === false || (bindData !== true && bindData[1] & 1)) {
        return func;
      }
      switch (argCount) {
        case 1: return function(value) {
          return func.call(thisArg, value);
        };
        case 2: return function(a, b) {
          return func.call(thisArg, a, b);
        };
        case 3: return function(value, index, collection) {
          return func.call(thisArg, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
          return func.call(thisArg, accumulator, value, index, collection);
        };
      }
      return bind(func, thisArg);
    }

    /**
     * The base implementation of `createWrapper` that creates the wrapper and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new function.
     */
    function baseCreateWrapper(bindData) {
      var func = bindData[0],
          bitmask = bindData[1],
          partialArgs = bindData[2],
          partialRightArgs = bindData[3],
          thisArg = bindData[4],
          arity = bindData[5];

      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          key = func;

      function bound() {
        var thisBinding = isBind ? thisArg : this;
        if (partialArgs) {
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        if (partialRightArgs || isCurry) {
          args || (args = slice(arguments));
          if (partialRightArgs) {
            push.apply(args, partialRightArgs);
          }
          if (isCurry && args.length < arity) {
            bitmask |= 16 & ~32;
            return baseCreateWrapper([func, (isCurryBound ? bitmask : bitmask & ~3), args, null, thisArg, arity]);
          }
        }
        args || (args = arguments);
        if (isBindKey) {
          func = thisBinding[key];
        }
        if (this instanceof bound) {
          thisBinding = baseCreate(func.prototype);
          var result = func.apply(thisBinding, args);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisBinding, args);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.difference` that accepts a single array
     * of values to exclude.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {Array} [values] The array of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     */
    function baseDifference(array, values) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          isLarge = length >= largeArraySize && indexOf === baseIndexOf,
          result = [];

      if (isLarge) {
        var cache = createCache(values);
        if (cache) {
          indexOf = cacheIndexOf;
          values = cache;
        } else {
          isLarge = false;
        }
      }
      while (++index < length) {
        var value = array[index];
        if (indexOf(values, value) < 0) {
          result.push(value);
        }
      }
      if (isLarge) {
        releaseObject(values);
      }
      return result;
    }

    /**
     * The base implementation of `_.flatten` without support for callback
     * shorthands or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {boolean} [isStrict=false] A flag to restrict flattening to arrays and `arguments` objects.
     * @param {number} [fromIndex=0] The index to start from.
     * @returns {Array} Returns a new flattened array.
     */
    function baseFlatten(array, isShallow, isStrict, fromIndex) {
      var index = (fromIndex || 0) - 1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];

        if (value && typeof value == 'object' && typeof value.length == 'number'
            && (isArray(value) || isArguments(value))) {
          // recursively flatten arrays (susceptible to call stack limits)
          if (!isShallow) {
            value = baseFlatten(value, isShallow, isStrict);
          }
          var valIndex = -1,
              valLength = value.length,
              resIndex = result.length;

          result.length += valLength;
          while (++valIndex < valLength) {
            result[resIndex++] = value[valIndex];
          }
        } else if (!isStrict) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * The base implementation of `_.isEqual`, without support for `thisArg` binding,
     * that allows partial "_.where" style comparisons.
     *
     * @private
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {Function} [isWhere=false] A flag to indicate performing partial comparisons.
     * @param {Array} [stackA=[]] Tracks traversed `a` objects.
     * @param {Array} [stackB=[]] Tracks traversed `b` objects.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     */
    function baseIsEqual(a, b, callback, isWhere, stackA, stackB) {
      // used to indicate that when comparing objects, `a` has at least the properties of `b`
      if (callback) {
        var result = callback(a, b);
        if (typeof result != 'undefined') {
          return !!result;
        }
      }
      // exit early for identical values
      if (a === b) {
        // treat `+0` vs. `-0` as not equal
        return a !== 0 || (1 / a == 1 / b);
      }
      var type = typeof a,
          otherType = typeof b;

      // exit early for unlike primitive values
      if (a === a &&
          !(a && objectTypes[type]) &&
          !(b && objectTypes[otherType])) {
        return false;
      }
      // exit early for `null` and `undefined` avoiding ES3's Function#call behavior
      // http://es5.github.io/#x15.3.4.4
      if (a == null || b == null) {
        return a === b;
      }
      // compare [[Class]] names
      var className = toString.call(a),
          otherClass = toString.call(b);

      if (className == argsClass) {
        className = objectClass;
      }
      if (otherClass == argsClass) {
        otherClass = objectClass;
      }
      if (className != otherClass) {
        return false;
      }
      switch (className) {
        case boolClass:
        case dateClass:
          // coerce dates and booleans to numbers, dates to milliseconds and booleans
          // to `1` or `0` treating invalid dates coerced to `NaN` as not equal
          return +a == +b;

        case numberClass:
          // treat `NaN` vs. `NaN` as equal
          return (a != +a)
            ? b != +b
            // but treat `+0` vs. `-0` as not equal
            : (a == 0 ? (1 / a == 1 / b) : a == +b);

        case regexpClass:
        case stringClass:
          // coerce regexes to strings (http://es5.github.io/#x15.10.6.4)
          // treat string primitives and their corresponding object instances as equal
          return a == String(b);
      }
      var isArr = className == arrayClass;
      if (!isArr) {
        // unwrap any `lodash` wrapped values
        var aWrapped = hasOwnProperty.call(a, '__wrapped__'),
            bWrapped = hasOwnProperty.call(b, '__wrapped__');

        if (aWrapped || bWrapped) {
          return baseIsEqual(aWrapped ? a.__wrapped__ : a, bWrapped ? b.__wrapped__ : b, callback, isWhere, stackA, stackB);
        }
        // exit for functions and DOM nodes
        if (className != objectClass) {
          return false;
        }
        // in older versions of Opera, `arguments` objects have `Array` constructors
        var ctorA = a.constructor,
            ctorB = b.constructor;

        // non `Object` object instances with different constructors are not equal
        if (ctorA != ctorB &&
              !(isFunction(ctorA) && ctorA instanceof ctorA && isFunction(ctorB) && ctorB instanceof ctorB) &&
              ('constructor' in a && 'constructor' in b)
            ) {
          return false;
        }
      }
      // assume cyclic structures are equal
      // the algorithm for detecting cyclic structures is adapted from ES 5.1
      // section 15.12.3, abstract operation `JO` (http://es5.github.io/#x15.12.3)
      var initedStack = !stackA;
      stackA || (stackA = getArray());
      stackB || (stackB = getArray());

      var length = stackA.length;
      while (length--) {
        if (stackA[length] == a) {
          return stackB[length] == b;
        }
      }
      var size = 0;
      result = true;

      // add `a` and `b` to the stack of traversed objects
      stackA.push(a);
      stackB.push(b);

      // recursively compare objects and arrays (susceptible to call stack limits)
      if (isArr) {
        // compare lengths to determine if a deep comparison is necessary
        length = a.length;
        size = b.length;
        result = size == length;

        if (result || isWhere) {
          // deep compare the contents, ignoring non-numeric properties
          while (size--) {
            var index = length,
                value = b[size];

            if (isWhere) {
              while (index--) {
                if ((result = baseIsEqual(a[index], value, callback, isWhere, stackA, stackB))) {
                  break;
                }
              }
            } else if (!(result = baseIsEqual(a[size], value, callback, isWhere, stackA, stackB))) {
              break;
            }
          }
        }
      }
      else {
        // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
        // which, in this case, is more costly
        forIn(b, function(value, key, b) {
          if (hasOwnProperty.call(b, key)) {
            // count the number of properties.
            size++;
            // deep compare each property value.
            return (result = hasOwnProperty.call(a, key) && baseIsEqual(a[key], value, callback, isWhere, stackA, stackB));
          }
        });

        if (result && !isWhere) {
          // ensure both objects have the same number of properties
          forIn(a, function(value, key, a) {
            if (hasOwnProperty.call(a, key)) {
              // `size` will be `-1` if `a` has more properties than `b`
              return (result = --size > -1);
            }
          });
        }
      }
      stackA.pop();
      stackB.pop();

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.merge` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {Object} object The destination object.
     * @param {Object} source The source object.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates values with source counterparts.
     */
    function baseMerge(object, source, callback, stackA, stackB) {
      (isArray(source) ? forEach : forOwn)(source, function(source, key) {
        var found,
            isArr,
            result = source,
            value = object[key];

        if (source && ((isArr = isArray(source)) || isPlainObject(source))) {
          // avoid merging previously merged cyclic sources
          var stackLength = stackA.length;
          while (stackLength--) {
            if ((found = stackA[stackLength] == source)) {
              value = stackB[stackLength];
              break;
            }
          }
          if (!found) {
            var isShallow;
            if (callback) {
              result = callback(value, source);
              if ((isShallow = typeof result != 'undefined')) {
                value = result;
              }
            }
            if (!isShallow) {
              value = isArr
                ? (isArray(value) ? value : [])
                : (isPlainObject(value) ? value : {});
            }
            // add `source` and associated `value` to the stack of traversed objects
            stackA.push(source);
            stackB.push(value);

            // recursively merge objects and arrays (susceptible to call stack limits)
            if (!isShallow) {
              baseMerge(value, source, callback, stackA, stackB);
            }
          }
        }
        else {
          if (callback) {
            result = callback(value, source);
            if (typeof result == 'undefined') {
              result = source;
            }
          }
          if (typeof result != 'undefined') {
            value = result;
          }
        }
        object[key] = value;
      });
    }

    /**
     * The base implementation of `_.random` without argument juggling or support
     * for returning floating-point numbers.
     *
     * @private
     * @param {number} min The minimum possible value.
     * @param {number} max The maximum possible value.
     * @returns {number} Returns a random number.
     */
    function baseRandom(min, max) {
      return min + floor(nativeRandom() * (max - min + 1));
    }

    /**
     * The base implementation of `_.uniq` without support for callback shorthands
     * or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function} [callback] The function called per iteration.
     * @returns {Array} Returns a duplicate-value-free array.
     */
    function baseUniq(array, isSorted, callback) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          result = [];

      var isLarge = !isSorted && length >= largeArraySize && indexOf === baseIndexOf,
          seen = (callback || isLarge) ? getArray() : result;

      if (isLarge) {
        var cache = createCache(seen);
        indexOf = cacheIndexOf;
        seen = cache;
      }
      while (++index < length) {
        var value = array[index],
            computed = callback ? callback(value, index, array) : value;

        if (isSorted
              ? !index || seen[seen.length - 1] !== computed
              : indexOf(seen, computed) < 0
            ) {
          if (callback || isLarge) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
      if (isLarge) {
        releaseArray(seen.array);
        releaseObject(seen);
      } else if (callback) {
        releaseArray(seen);
      }
      return result;
    }

    /**
     * Creates a function that aggregates a collection, creating an object composed
     * of keys generated from the results of running each element of the collection
     * through a callback. The given `setter` function sets the keys and values
     * of the composed object.
     *
     * @private
     * @param {Function} setter The setter function.
     * @returns {Function} Returns the new aggregator function.
     */
    function createAggregator(setter) {
      return function(collection, callback, thisArg) {
        var result = {};
        callback = lodash.createCallback(callback, thisArg, 3);

        var index = -1,
            length = collection ? collection.length : 0;

        if (typeof length == 'number') {
          while (++index < length) {
            var value = collection[index];
            setter(result, value, callback(value, index, collection), collection);
          }
        } else {
          forOwn(collection, function(value, key, collection) {
            setter(result, value, callback(value, key, collection), collection);
          });
        }
        return result;
      };
    }

    /**
     * Creates a function that, when called, either curries or invokes `func`
     * with an optional `this` binding and partially applied arguments.
     *
     * @private
     * @param {Function|string} func The function or method name to reference.
     * @param {number} bitmask The bitmask of method flags to compose.
     *  The bitmask may be composed of the following flags:
     *  1 - `_.bind`
     *  2 - `_.bindKey`
     *  4 - `_.curry`
     *  8 - `_.curry` (bound)
     *  16 - `_.partial`
     *  32 - `_.partialRight`
     * @param {Array} [partialArgs] An array of arguments to prepend to those
     *  provided to the new function.
     * @param {Array} [partialRightArgs] An array of arguments to append to those
     *  provided to the new function.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {number} [arity] The arity of `func`.
     * @returns {Function} Returns the new function.
     */
    function createWrapper(func, bitmask, partialArgs, partialRightArgs, thisArg, arity) {
      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          isPartial = bitmask & 16,
          isPartialRight = bitmask & 32;

      if (!isBindKey && !isFunction(func)) {
        throw new TypeError;
      }
      if (isPartial && !partialArgs.length) {
        bitmask &= ~16;
        isPartial = partialArgs = false;
      }
      if (isPartialRight && !partialRightArgs.length) {
        bitmask &= ~32;
        isPartialRight = partialRightArgs = false;
      }
      var bindData = func && func.__bindData__;
      if (bindData && bindData !== true) {
        // clone `bindData`
        bindData = slice(bindData);
        if (bindData[2]) {
          bindData[2] = slice(bindData[2]);
        }
        if (bindData[3]) {
          bindData[3] = slice(bindData[3]);
        }
        // set `thisBinding` is not previously bound
        if (isBind && !(bindData[1] & 1)) {
          bindData[4] = thisArg;
        }
        // set if previously bound but not currently (subsequent curried functions)
        if (!isBind && bindData[1] & 1) {
          bitmask |= 8;
        }
        // set curried arity if not yet set
        if (isCurry && !(bindData[1] & 4)) {
          bindData[5] = arity;
        }
        // append partial left arguments
        if (isPartial) {
          push.apply(bindData[2] || (bindData[2] = []), partialArgs);
        }
        // append partial right arguments
        if (isPartialRight) {
          unshift.apply(bindData[3] || (bindData[3] = []), partialRightArgs);
        }
        // merge flags
        bindData[1] |= bitmask;
        return createWrapper.apply(null, bindData);
      }
      // fast path for `_.bind`
      var creater = (bitmask == 1 || bitmask === 17) ? baseBind : baseCreateWrapper;
      return creater([func, bitmask, partialArgs, partialRightArgs, thisArg, arity]);
    }

    /**
     * Used by `escape` to convert characters to HTML entities.
     *
     * @private
     * @param {string} match The matched character to escape.
     * @returns {string} Returns the escaped character.
     */
    function escapeHtmlChar(match) {
      return htmlEscapes[match];
    }

    /**
     * Gets the appropriate "indexOf" function. If the `_.indexOf` method is
     * customized, this method returns the custom method, otherwise it returns
     * the `baseIndexOf` function.
     *
     * @private
     * @returns {Function} Returns the "indexOf" function.
     */
    function getIndexOf() {
      var result = (result = lodash.indexOf) === indexOf ? baseIndexOf : result;
      return result;
    }

    /**
     * Checks if `value` is a native function.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a native function, else `false`.
     */
    function isNative(value) {
      return typeof value == 'function' && reNative.test(value);
    }

    /**
     * Sets `this` binding data on a given function.
     *
     * @private
     * @param {Function} func The function to set data on.
     * @param {Array} value The data array to set.
     */
    var setBindData = !defineProperty ? noop : function(func, value) {
      descriptor.value = value;
      defineProperty(func, '__bindData__', descriptor);
    };

    /**
     * A fallback implementation of `isPlainObject` which checks if a given value
     * is an object created by the `Object` constructor, assuming objects created
     * by the `Object` constructor have no inherited enumerable properties and that
     * there are no `Object.prototype` extensions.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     */
    function shimIsPlainObject(value) {
      var ctor,
          result;

      // avoid non Object objects, `arguments` objects, and DOM elements
      if (!(value && toString.call(value) == objectClass) ||
          (ctor = value.constructor, isFunction(ctor) && !(ctor instanceof ctor))) {
        return false;
      }
      // In most environments an object's own properties are iterated before
      // its inherited properties. If the last iterated property is an object's
      // own property then there are no inherited enumerable properties.
      forIn(value, function(value, key) {
        result = key;
      });
      return typeof result == 'undefined' || hasOwnProperty.call(value, result);
    }

    /**
     * Used by `unescape` to convert HTML entities to characters.
     *
     * @private
     * @param {string} match The matched character to unescape.
     * @returns {string} Returns the unescaped character.
     */
    function unescapeHtmlChar(match) {
      return htmlUnescapes[match];
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Checks if `value` is an `arguments` object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an `arguments` object, else `false`.
     * @example
     *
     * (function() { return _.isArguments(arguments); })(1, 2, 3);
     * // => true
     *
     * _.isArguments([1, 2, 3]);
     * // => false
     */
    function isArguments(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == argsClass || false;
    }

    /**
     * Checks if `value` is an array.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an array, else `false`.
     * @example
     *
     * (function() { return _.isArray(arguments); })();
     * // => false
     *
     * _.isArray([1, 2, 3]);
     * // => true
     */
    var isArray = nativeIsArray || function(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == arrayClass || false;
    };

    /**
     * A fallback implementation of `Object.keys` which produces an array of the
     * given object's own enumerable property names.
     *
     * @private
     * @type Function
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     */
    var shimKeys = function(object) {
      var index, iterable = object, result = [];
      if (!iterable) return result;
      if (!(objectTypes[typeof object])) return result;
        for (index in iterable) {
          if (hasOwnProperty.call(iterable, index)) {
            result.push(index);
          }
        }
      return result
    };

    /**
     * Creates an array composed of the own enumerable property names of an object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     * @example
     *
     * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
     * // => ['one', 'two', 'three'] (property order is not guaranteed across environments)
     */
    var keys = !nativeKeys ? shimKeys : function(object) {
      if (!isObject(object)) {
        return [];
      }
      return nativeKeys(object);
    };

    /**
     * Used to convert characters to HTML entities:
     *
     * Though the `>` character is escaped for symmetry, characters like `>` and `/`
     * don't require escaping in HTML and have no special meaning unless they're part
     * of a tag or an unquoted attribute value.
     * http://mathiasbynens.be/notes/ambiguous-ampersands (under "semi-related fun fact")
     */
    var htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    /** Used to convert HTML entities to characters */
    var htmlUnescapes = invert(htmlEscapes);

    /** Used to match HTML entities and HTML characters */
    var reEscapedHtml = RegExp('(' + keys(htmlUnescapes).join('|') + ')', 'g'),
        reUnescapedHtml = RegExp('[' + keys(htmlEscapes).join('') + ']', 'g');

    /*--------------------------------------------------------------------------*/

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object. Subsequent sources will overwrite property assignments of previous
     * sources. If a callback is provided it will be executed to produce the
     * assigned values. The callback is bound to `thisArg` and invoked with two
     * arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @type Function
     * @alias extend
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize assigning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * _.assign({ 'name': 'fred' }, { 'employer': 'slate' });
     * // => { 'name': 'fred', 'employer': 'slate' }
     *
     * var defaults = _.partialRight(_.assign, function(a, b) {
     *   return typeof a == 'undefined' ? b : a;
     * });
     *
     * var object = { 'name': 'barney' };
     * defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var assign = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      if (argsLength > 3 && typeof args[argsLength - 2] == 'function') {
        var callback = baseCreateCallback(args[--argsLength - 1], args[argsLength--], 2);
      } else if (argsLength > 2 && typeof args[argsLength - 1] == 'function') {
        callback = args[--argsLength];
      }
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          result[index] = callback ? callback(result[index], iterable[index]) : iterable[index];
        }
        }
      }
      return result
    };

    /**
     * Creates a clone of `value`. If `isDeep` is `true` nested objects will also
     * be cloned, otherwise they will be assigned by reference. If a callback
     * is provided it will be executed to produce the cloned values. If the
     * callback returns `undefined` cloning will be handled by the method instead.
     * The callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var shallow = _.clone(characters);
     * shallow[0] === characters[0];
     * // => true
     *
     * var deep = _.clone(characters, true);
     * deep[0] === characters[0];
     * // => false
     *
     * _.mixin({
     *   'clone': _.partialRight(_.clone, function(value) {
     *     return _.isElement(value) ? value.cloneNode(false) : undefined;
     *   })
     * });
     *
     * var clone = _.clone(document.body);
     * clone.childNodes.length;
     * // => 0
     */
    function clone(value, isDeep, callback, thisArg) {
      // allows working with "Collections" methods without using their `index`
      // and `collection` arguments for `isDeep` and `callback`
      if (typeof isDeep != 'boolean' && isDeep != null) {
        thisArg = callback;
        callback = isDeep;
        isDeep = false;
      }
      return baseClone(value, isDeep, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates a deep clone of `value`. If a callback is provided it will be
     * executed to produce the cloned values. If the callback returns `undefined`
     * cloning will be handled by the method instead. The callback is bound to
     * `thisArg` and invoked with one argument; (value).
     *
     * Note: This method is loosely based on the structured clone algorithm. Functions
     * and DOM nodes are **not** cloned. The enumerable properties of `arguments` objects and
     * objects created by constructors other than `Object` are cloned to plain `Object` objects.
     * See http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the deep cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var deep = _.cloneDeep(characters);
     * deep[0] === characters[0];
     * // => false
     *
     * var view = {
     *   'label': 'docs',
     *   'node': element
     * };
     *
     * var clone = _.cloneDeep(view, function(value) {
     *   return _.isElement(value) ? value.cloneNode(true) : undefined;
     * });
     *
     * clone.node == view.node;
     * // => false
     */
    function cloneDeep(value, callback, thisArg) {
      return baseClone(value, true, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates an object that inherits from the given `prototype` object. If a
     * `properties` object is provided its own enumerable properties are assigned
     * to the created object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} prototype The object to inherit from.
     * @param {Object} [properties] The properties to assign to the object.
     * @returns {Object} Returns the new object.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * function Circle() {
     *   Shape.call(this);
     * }
     *
     * Circle.prototype = _.create(Shape.prototype, { 'constructor': Circle });
     *
     * var circle = new Circle;
     * circle instanceof Circle;
     * // => true
     *
     * circle instanceof Shape;
     * // => true
     */
    function create(prototype, properties) {
      var result = baseCreate(prototype);
      return properties ? assign(result, properties) : result;
    }

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object for all destination properties that resolve to `undefined`. Once a
     * property is set, additional defaults of the same property will be ignored.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param- {Object} [guard] Allows working with `_.reduce` without using its
     *  `key` and `object` arguments as sources.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var object = { 'name': 'barney' };
     * _.defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var defaults = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (typeof result[index] == 'undefined') result[index] = iterable[index];
        }
        }
      }
      return result
    };

    /**
     * This method is like `_.findIndex` except that it returns the key of the
     * first element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': false },
     *   'fred': {    'age': 40, 'blocked': true },
     *   'pebbles': { 'age': 1,  'blocked': false }
     * };
     *
     * _.findKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => 'barney' (property order is not guaranteed across environments)
     *
     * // using "_.where" callback shorthand
     * _.findKey(characters, { 'age': 1 });
     * // => 'pebbles'
     *
     * // using "_.pluck" callback shorthand
     * _.findKey(characters, 'blocked');
     * // => 'fred'
     */
    function findKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwn(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * This method is like `_.findKey` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': true },
     *   'fred': {    'age': 40, 'blocked': false },
     *   'pebbles': { 'age': 1,  'blocked': true }
     * };
     *
     * _.findLastKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => returns `pebbles`, assuming `_.findKey` returns `barney`
     *
     * // using "_.where" callback shorthand
     * _.findLastKey(characters, { 'age': 40 });
     * // => 'fred'
     *
     * // using "_.pluck" callback shorthand
     * _.findLastKey(characters, 'blocked');
     * // => 'pebbles'
     */
    function findLastKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwnRight(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over own and inherited enumerable properties of an object,
     * executing the callback for each property. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, key, object). Callbacks may exit
     * iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forIn(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'x', 'y', and 'move' (property order is not guaranteed across environments)
     */
    var forIn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        for (index in iterable) {
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forIn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forInRight(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'move', 'y', and 'x' assuming `_.forIn ` logs 'x', 'y', and 'move'
     */
    function forInRight(object, callback, thisArg) {
      var pairs = [];

      forIn(object, function(value, key) {
        pairs.push(key, value);
      });

      var length = pairs.length;
      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(pairs[length--], pairs[length], object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Iterates over own enumerable properties of an object, executing the callback
     * for each property. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, key, object). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs '0', '1', and 'length' (property order is not guaranteed across environments)
     */
    var forOwn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forOwn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwnRight({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs 'length', '1', and '0' assuming `_.forOwn` logs '0', '1', and 'length'
     */
    function forOwnRight(object, callback, thisArg) {
      var props = keys(object),
          length = props.length;

      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        var key = props[length];
        if (callback(object[key], key, object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Creates a sorted array of property names of all enumerable properties,
     * own and inherited, of `object` that have function values.
     *
     * @static
     * @memberOf _
     * @alias methods
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names that have function values.
     * @example
     *
     * _.functions(_);
     * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
     */
    function functions(object) {
      var result = [];
      forIn(object, function(value, key) {
        if (isFunction(value)) {
          result.push(key);
        }
      });
      return result.sort();
    }

    /**
     * Checks if the specified property name exists as a direct property of `object`,
     * instead of an inherited property.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to check.
     * @returns {boolean} Returns `true` if key is a direct property, else `false`.
     * @example
     *
     * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
     * // => true
     */
    function has(object, key) {
      return object ? hasOwnProperty.call(object, key) : false;
    }

    /**
     * Creates an object composed of the inverted keys and values of the given object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to invert.
     * @returns {Object} Returns the created inverted object.
     * @example
     *
     * _.invert({ 'first': 'fred', 'second': 'barney' });
     * // => { 'fred': 'first', 'barney': 'second' }
     */
    function invert(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = {};

      while (++index < length) {
        var key = props[index];
        result[object[key]] = key;
      }
      return result;
    }

    /**
     * Checks if `value` is a boolean value.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a boolean value, else `false`.
     * @example
     *
     * _.isBoolean(null);
     * // => false
     */
    function isBoolean(value) {
      return value === true || value === false ||
        value && typeof value == 'object' && toString.call(value) == boolClass || false;
    }

    /**
     * Checks if `value` is a date.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a date, else `false`.
     * @example
     *
     * _.isDate(new Date);
     * // => true
     */
    function isDate(value) {
      return value && typeof value == 'object' && toString.call(value) == dateClass || false;
    }

    /**
     * Checks if `value` is a DOM element.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a DOM element, else `false`.
     * @example
     *
     * _.isElement(document.body);
     * // => true
     */
    function isElement(value) {
      return value && value.nodeType === 1 || false;
    }

    /**
     * Checks if `value` is empty. Arrays, strings, or `arguments` objects with a
     * length of `0` and objects with no own enumerable properties are considered
     * "empty".
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object|string} value The value to inspect.
     * @returns {boolean} Returns `true` if the `value` is empty, else `false`.
     * @example
     *
     * _.isEmpty([1, 2, 3]);
     * // => false
     *
     * _.isEmpty({});
     * // => true
     *
     * _.isEmpty('');
     * // => true
     */
    function isEmpty(value) {
      var result = true;
      if (!value) {
        return result;
      }
      var className = toString.call(value),
          length = value.length;

      if ((className == arrayClass || className == stringClass || className == argsClass ) ||
          (className == objectClass && typeof length == 'number' && isFunction(value.splice))) {
        return !length;
      }
      forOwn(value, function() {
        return (result = false);
      });
      return result;
    }

    /**
     * Performs a deep comparison between two values to determine if they are
     * equivalent to each other. If a callback is provided it will be executed
     * to compare values. If the callback returns `undefined` comparisons will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (a, b).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var copy = { 'name': 'fred' };
     *
     * object == copy;
     * // => false
     *
     * _.isEqual(object, copy);
     * // => true
     *
     * var words = ['hello', 'goodbye'];
     * var otherWords = ['hi', 'goodbye'];
     *
     * _.isEqual(words, otherWords, function(a, b) {
     *   var reGreet = /^(?:hello|hi)$/i,
     *       aGreet = _.isString(a) && reGreet.test(a),
     *       bGreet = _.isString(b) && reGreet.test(b);
     *
     *   return (aGreet || bGreet) ? (aGreet == bGreet) : undefined;
     * });
     * // => true
     */
    function isEqual(a, b, callback, thisArg) {
      return baseIsEqual(a, b, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 2));
    }

    /**
     * Checks if `value` is, or can be coerced to, a finite number.
     *
     * Note: This is not the same as native `isFinite` which will return true for
     * booleans and empty strings. See http://es5.github.io/#x15.1.2.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is finite, else `false`.
     * @example
     *
     * _.isFinite(-101);
     * // => true
     *
     * _.isFinite('10');
     * // => true
     *
     * _.isFinite(true);
     * // => false
     *
     * _.isFinite('');
     * // => false
     *
     * _.isFinite(Infinity);
     * // => false
     */
    function isFinite(value) {
      return nativeIsFinite(value) && !nativeIsNaN(parseFloat(value));
    }

    /**
     * Checks if `value` is a function.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a function, else `false`.
     * @example
     *
     * _.isFunction(_);
     * // => true
     */
    function isFunction(value) {
      return typeof value == 'function';
    }

    /**
     * Checks if `value` is the language type of Object.
     * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an object, else `false`.
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(1);
     * // => false
     */
    function isObject(value) {
      // check if the value is the ECMAScript language type of Object
      // http://es5.github.io/#x8
      // and avoid a V8 bug
      // http://code.google.com/p/v8/issues/detail?id=2291
      return !!(value && objectTypes[typeof value]);
    }

    /**
     * Checks if `value` is `NaN`.
     *
     * Note: This is not the same as native `isNaN` which will return `true` for
     * `undefined` and other non-numeric values. See http://es5.github.io/#x15.1.2.4.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `NaN`, else `false`.
     * @example
     *
     * _.isNaN(NaN);
     * // => true
     *
     * _.isNaN(new Number(NaN));
     * // => true
     *
     * isNaN(undefined);
     * // => true
     *
     * _.isNaN(undefined);
     * // => false
     */
    function isNaN(value) {
      // `NaN` as a primitive is the only value that is not equal to itself
      // (perform the [[Class]] check first to avoid errors with some host objects in IE)
      return isNumber(value) && value != +value;
    }

    /**
     * Checks if `value` is `null`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `null`, else `false`.
     * @example
     *
     * _.isNull(null);
     * // => true
     *
     * _.isNull(undefined);
     * // => false
     */
    function isNull(value) {
      return value === null;
    }

    /**
     * Checks if `value` is a number.
     *
     * Note: `NaN` is considered a number. See http://es5.github.io/#x8.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a number, else `false`.
     * @example
     *
     * _.isNumber(8.4 * 5);
     * // => true
     */
    function isNumber(value) {
      return typeof value == 'number' ||
        value && typeof value == 'object' && toString.call(value) == numberClass || false;
    }

    /**
     * Checks if `value` is an object created by the `Object` constructor.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * _.isPlainObject(new Shape);
     * // => false
     *
     * _.isPlainObject([1, 2, 3]);
     * // => false
     *
     * _.isPlainObject({ 'x': 0, 'y': 0 });
     * // => true
     */
    var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
      if (!(value && toString.call(value) == objectClass)) {
        return false;
      }
      var valueOf = value.valueOf,
          objProto = isNative(valueOf) && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

      return objProto
        ? (value == objProto || getPrototypeOf(value) == objProto)
        : shimIsPlainObject(value);
    };

    /**
     * Checks if `value` is a regular expression.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a regular expression, else `false`.
     * @example
     *
     * _.isRegExp(/fred/);
     * // => true
     */
    function isRegExp(value) {
      return value && typeof value == 'object' && toString.call(value) == regexpClass || false;
    }

    /**
     * Checks if `value` is a string.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a string, else `false`.
     * @example
     *
     * _.isString('fred');
     * // => true
     */
    function isString(value) {
      return typeof value == 'string' ||
        value && typeof value == 'object' && toString.call(value) == stringClass || false;
    }

    /**
     * Checks if `value` is `undefined`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `undefined`, else `false`.
     * @example
     *
     * _.isUndefined(void 0);
     * // => true
     */
    function isUndefined(value) {
      return typeof value == 'undefined';
    }

    /**
     * Creates an object with the same keys as `object` and values generated by
     * running each own enumerable property of `object` through the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new object with values of the results of each `callback` execution.
     * @example
     *
     * _.mapValues({ 'a': 1, 'b': 2, 'c': 3} , function(num) { return num * 3; });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     *
     * var characters = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // using "_.pluck" callback shorthand
     * _.mapValues(characters, 'age');
     * // => { 'fred': 40, 'pebbles': 1 }
     */
    function mapValues(object, callback, thisArg) {
      var result = {};
      callback = lodash.createCallback(callback, thisArg, 3);

      forOwn(object, function(value, key, object) {
        result[key] = callback(value, key, object);
      });
      return result;
    }

    /**
     * Recursively merges own enumerable properties of the source object(s), that
     * don't resolve to `undefined` into the destination object. Subsequent sources
     * will overwrite property assignments of previous sources. If a callback is
     * provided it will be executed to produce the merged values of the destination
     * and source properties. If the callback returns `undefined` merging will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var names = {
     *   'characters': [
     *     { 'name': 'barney' },
     *     { 'name': 'fred' }
     *   ]
     * };
     *
     * var ages = {
     *   'characters': [
     *     { 'age': 36 },
     *     { 'age': 40 }
     *   ]
     * };
     *
     * _.merge(names, ages);
     * // => { 'characters': [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred', 'age': 40 }] }
     *
     * var food = {
     *   'fruits': ['apple'],
     *   'vegetables': ['beet']
     * };
     *
     * var otherFood = {
     *   'fruits': ['banana'],
     *   'vegetables': ['carrot']
     * };
     *
     * _.merge(food, otherFood, function(a, b) {
     *   return _.isArray(a) ? a.concat(b) : undefined;
     * });
     * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot] }
     */
    function merge(object) {
      var args = arguments,
          length = 2;

      if (!isObject(object)) {
        return object;
      }
      // allows working with `_.reduce` and `_.reduceRight` without using
      // their `index` and `collection` arguments
      if (typeof args[2] != 'number') {
        length = args.length;
      }
      if (length > 3 && typeof args[length - 2] == 'function') {
        var callback = baseCreateCallback(args[--length - 1], args[length--], 2);
      } else if (length > 2 && typeof args[length - 1] == 'function') {
        callback = args[--length];
      }
      var sources = slice(arguments, 1, length),
          index = -1,
          stackA = getArray(),
          stackB = getArray();

      while (++index < length) {
        baseMerge(object, sources[index], callback, stackA, stackB);
      }
      releaseArray(stackA);
      releaseArray(stackB);
      return object;
    }

    /**
     * Creates a shallow clone of `object` excluding the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` omitting the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The properties to omit or the
     *  function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object without the omitted properties.
     * @example
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, 'age');
     * // => { 'name': 'fred' }
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, function(value) {
     *   return typeof value == 'number';
     * });
     * // => { 'name': 'fred' }
     */
    function omit(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var props = [];
        forIn(object, function(value, key) {
          props.push(key);
        });
        props = baseDifference(props, baseFlatten(arguments, true, false, 1));

        var index = -1,
            length = props.length;

        while (++index < length) {
          var key = props[index];
          result[key] = object[key];
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (!callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * Creates a two dimensional array of an object's key-value pairs,
     * i.e. `[[key1, value1], [key2, value2]]`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns new array of key-value pairs.
     * @example
     *
     * _.pairs({ 'barney': 36, 'fred': 40 });
     * // => [['barney', 36], ['fred', 40]] (property order is not guaranteed across environments)
     */
    function pairs(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        var key = props[index];
        result[index] = [key, object[key]];
      }
      return result;
    }

    /**
     * Creates a shallow clone of `object` composed of the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` picking the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The function called per
     *  iteration or property names to pick, specified as individual property
     *  names or arrays of property names.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object composed of the picked properties.
     * @example
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, 'name');
     * // => { 'name': 'fred' }
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, function(value, key) {
     *   return key.charAt(0) != '_';
     * });
     * // => { 'name': 'fred' }
     */
    function pick(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var index = -1,
            props = baseFlatten(arguments, true, false, 1),
            length = isObject(object) ? props.length : 0;

        while (++index < length) {
          var key = props[index];
          if (key in object) {
            result[key] = object[key];
          }
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * An alternative to `_.reduce` this method transforms `object` to a new
     * `accumulator` object which is the result of running each of its own
     * enumerable properties through a callback, with each callback execution
     * potentially mutating the `accumulator` object. The callback is bound to
     * `thisArg` and invoked with four arguments; (accumulator, value, key, object).
     * Callbacks may exit iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] The custom accumulator value.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var squares = _.transform([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], function(result, num) {
     *   num *= num;
     *   if (num % 2) {
     *     return result.push(num) < 3;
     *   }
     * });
     * // => [1, 9, 25]
     *
     * var mapped = _.transform({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     * });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function transform(object, callback, accumulator, thisArg) {
      var isArr = isArray(object);
      if (accumulator == null) {
        if (isArr) {
          accumulator = [];
        } else {
          var ctor = object && object.constructor,
              proto = ctor && ctor.prototype;

          accumulator = baseCreate(proto);
        }
      }
      if (callback) {
        callback = lodash.createCallback(callback, thisArg, 4);
        (isArr ? forEach : forOwn)(object, function(value, index, object) {
          return callback(accumulator, value, index, object);
        });
      }
      return accumulator;
    }

    /**
     * Creates an array composed of the own enumerable property values of `object`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property values.
     * @example
     *
     * _.values({ 'one': 1, 'two': 2, 'three': 3 });
     * // => [1, 2, 3] (property order is not guaranteed across environments)
     */
    function values(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        result[index] = object[props[index]];
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array of elements from the specified indexes, or keys, of the
     * `collection`. Indexes may be specified as individual arguments or as arrays
     * of indexes.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {...(number|number[]|string|string[])} [index] The indexes of `collection`
     *   to retrieve, specified as individual indexes or arrays of indexes.
     * @returns {Array} Returns a new array of elements corresponding to the
     *  provided indexes.
     * @example
     *
     * _.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
     * // => ['a', 'c', 'e']
     *
     * _.at(['fred', 'barney', 'pebbles'], 0, 2);
     * // => ['fred', 'pebbles']
     */
    function at(collection) {
      var args = arguments,
          index = -1,
          props = baseFlatten(args, true, false, 1),
          length = (args[2] && args[2][args[1]] === collection) ? 1 : props.length,
          result = Array(length);

      while(++index < length) {
        result[index] = collection[props[index]];
      }
      return result;
    }

    /**
     * Checks if a given value is present in a collection using strict equality
     * for comparisons, i.e. `===`. If `fromIndex` is negative, it is used as the
     * offset from the end of the collection.
     *
     * @static
     * @memberOf _
     * @alias include
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {*} target The value to check for.
     * @param {number} [fromIndex=0] The index to search from.
     * @returns {boolean} Returns `true` if the `target` element is found, else `false`.
     * @example
     *
     * _.contains([1, 2, 3], 1);
     * // => true
     *
     * _.contains([1, 2, 3], 1, 2);
     * // => false
     *
     * _.contains({ 'name': 'fred', 'age': 40 }, 'fred');
     * // => true
     *
     * _.contains('pebbles', 'eb');
     * // => true
     */
    function contains(collection, target, fromIndex) {
      var index = -1,
          indexOf = getIndexOf(),
          length = collection ? collection.length : 0,
          result = false;

      fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex) || 0;
      if (isArray(collection)) {
        result = indexOf(collection, target, fromIndex) > -1;
      } else if (typeof length == 'number') {
        result = (isString(collection) ? collection.indexOf(target, fromIndex) : indexOf(collection, target, fromIndex)) > -1;
      } else {
        forOwn(collection, function(value) {
          if (++index >= fromIndex) {
            return !(result = value === target);
          }
        });
      }
      return result;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of `collection` through the callback. The corresponding value
     * of each key is the number of times the key was returned by the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy(['one', 'two', 'three'], 'length');
     * // => { '3': 2, '5': 1 }
     */
    var countBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key]++ : result[key] = 1);
    });

    /**
     * Checks if the given callback returns truey value for **all** elements of
     * a collection. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias all
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if all elements passed the callback check,
     *  else `false`.
     * @example
     *
     * _.every([true, 1, null, 'yes']);
     * // => false
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.every(characters, 'age');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.every(characters, { 'age': 36 });
     * // => false
     */
    function every(collection, callback, thisArg) {
      var result = true;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if (!(result = !!callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return (result = !!callback(value, index, collection));
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning an array of all elements
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias select
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that passed the callback check.
     * @example
     *
     * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [2, 4, 6]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.filter(characters, 'blocked');
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     *
     * // using "_.where" callback shorthand
     * _.filter(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     */
    function filter(collection, callback, thisArg) {
      var result = [];
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            result.push(value);
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result.push(value);
          }
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning the first element that
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias detect, findWhere
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.find(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => { 'name': 'barney', 'age': 36, 'blocked': false }
     *
     * // using "_.where" callback shorthand
     * _.find(characters, { 'age': 1 });
     * // =>  { 'name': 'pebbles', 'age': 1, 'blocked': false }
     *
     * // using "_.pluck" callback shorthand
     * _.find(characters, 'blocked');
     * // => { 'name': 'fred', 'age': 40, 'blocked': true }
     */
    function find(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            return value;
          }
        }
      } else {
        var result;
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result = value;
            return false;
          }
        });
        return result;
      }
    }

    /**
     * This method is like `_.find` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * _.findLast([1, 2, 3, 4], function(num) {
     *   return num % 2 == 1;
     * });
     * // => 3
     */
    function findLast(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forEachRight(collection, function(value, index, collection) {
        if (callback(value, index, collection)) {
          result = value;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over elements of a collection, executing the callback for each
     * element. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * Note: As with other "Collections" methods, objects with a `length` property
     * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
     * may be used for object iteration.
     *
     * @static
     * @memberOf _
     * @alias each
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEach(function(num) { console.log(num); }).join(',');
     * // => logs each number and returns '1,2,3'
     *
     * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { console.log(num); });
     * // => logs each number and returns the object (property order is not guaranteed across environments)
     */
    function forEach(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (++index < length) {
          if (callback(collection[index], index, collection) === false) {
            break;
          }
        }
      } else {
        forOwn(collection, callback);
      }
      return collection;
    }

    /**
     * This method is like `_.forEach` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias eachRight
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEachRight(function(num) { console.log(num); }).join(',');
     * // => logs each number from right to left and returns '3,2,1'
     */
    function forEachRight(collection, callback, thisArg) {
      var length = collection ? collection.length : 0;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (length--) {
          if (callback(collection[length], length, collection) === false) {
            break;
          }
        }
      } else {
        var props = keys(collection);
        length = props.length;
        forOwn(collection, function(value, key, collection) {
          key = props ? props[--length] : --length;
          return callback(collection[key], key, collection);
        });
      }
      return collection;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of a collection through the callback. The corresponding value
     * of each key is an array of the elements responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * // using "_.pluck" callback shorthand
     * _.groupBy(['one', 'two', 'three'], 'length');
     * // => { '3': ['one', 'two'], '5': ['three'] }
     */
    var groupBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key] : result[key] = []).push(value);
    });

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of the collection through the given callback. The corresponding
     * value of each key is the last element responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * var keys = [
     *   { 'dir': 'left', 'code': 97 },
     *   { 'dir': 'right', 'code': 100 }
     * ];
     *
     * _.indexBy(keys, 'dir');
     * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(keys, function(key) { return String.fromCharCode(key.code); });
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(characters, function(key) { this.fromCharCode(key.code); }, String);
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     */
    var indexBy = createAggregator(function(result, value, key) {
      result[key] = value;
    });

    /**
     * Invokes the method named by `methodName` on each element in the `collection`
     * returning an array of the results of each invoked method. Additional arguments
     * will be provided to each invoked method. If `methodName` is a function it
     * will be invoked for, and `this` bound to, each element in the `collection`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|string} methodName The name of the method to invoke or
     *  the function invoked per iteration.
     * @param {...*} [arg] Arguments to invoke the method with.
     * @returns {Array} Returns a new array of the results of each invoked method.
     * @example
     *
     * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
     * // => [[1, 5, 7], [1, 2, 3]]
     *
     * _.invoke([123, 456], String.prototype.split, '');
     * // => [['1', '2', '3'], ['4', '5', '6']]
     */
    function invoke(collection, methodName) {
      var args = slice(arguments, 2),
          index = -1,
          isFunc = typeof methodName == 'function',
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        result[++index] = (isFunc ? methodName : value[methodName]).apply(value, args);
      });
      return result;
    }

    /**
     * Creates an array of values by running each element in the collection
     * through the callback. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias collect
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of the results of each `callback` execution.
     * @example
     *
     * _.map([1, 2, 3], function(num) { return num * 3; });
     * // => [3, 6, 9]
     *
     * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
     * // => [3, 6, 9] (property order is not guaranteed across environments)
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(characters, 'name');
     * // => ['barney', 'fred']
     */
    function map(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        var result = Array(length);
        while (++index < length) {
          result[index] = callback(collection[index], index, collection);
        }
      } else {
        result = [];
        forOwn(collection, function(value, key, collection) {
          result[++index] = callback(value, key, collection);
        });
      }
      return result;
    }

    /**
     * Retrieves the maximum value of a collection. If the collection is empty or
     * falsey `-Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the maximum value.
     * @example
     *
     * _.max([4, 2, 8, 6]);
     * // => 8
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.max(characters, function(chr) { return chr.age; });
     * // => { 'name': 'fred', 'age': 40 };
     *
     * // using "_.pluck" callback shorthand
     * _.max(characters, 'age');
     * // => { 'name': 'fred', 'age': 40 };
     */
    function max(collection, callback, thisArg) {
      var computed = -Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value > result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current > computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the minimum value of a collection. If the collection is empty or
     * falsey `Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the minimum value.
     * @example
     *
     * _.min([4, 2, 8, 6]);
     * // => 2
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.min(characters, function(chr) { return chr.age; });
     * // => { 'name': 'barney', 'age': 36 };
     *
     * // using "_.pluck" callback shorthand
     * _.min(characters, 'age');
     * // => { 'name': 'barney', 'age': 36 };
     */
    function min(collection, callback, thisArg) {
      var computed = Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value < result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current < computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the value of a specified property from all elements in the collection.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {string} property The name of the property to pluck.
     * @returns {Array} Returns a new array of property values.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.pluck(characters, 'name');
     * // => ['barney', 'fred']
     */
    var pluck = map;

    /**
     * Reduces a collection to a value which is the accumulated result of running
     * each element in the collection through the callback, where each successive
     * callback execution consumes the return value of the previous execution. If
     * `accumulator` is not provided the first element of the collection will be
     * used as the initial `accumulator` value. The callback is bound to `thisArg`
     * and invoked with four arguments; (accumulator, value, index|key, collection).
     *
     * @static
     * @memberOf _
     * @alias foldl, inject
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var sum = _.reduce([1, 2, 3], function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * var mapped = _.reduce({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     *   return result;
     * }, {});
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function reduce(collection, callback, accumulator, thisArg) {
      if (!collection) return accumulator;
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);

      var index = -1,
          length = collection.length;

      if (typeof length == 'number') {
        if (noaccum) {
          accumulator = collection[++index];
        }
        while (++index < length) {
          accumulator = callback(accumulator, collection[index], index, collection);
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          accumulator = noaccum
            ? (noaccum = false, value)
            : callback(accumulator, value, index, collection)
        });
      }
      return accumulator;
    }

    /**
     * This method is like `_.reduce` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias foldr
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var list = [[0, 1], [2, 3], [4, 5]];
     * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
     * // => [4, 5, 2, 3, 0, 1]
     */
    function reduceRight(collection, callback, accumulator, thisArg) {
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);
      forEachRight(collection, function(value, index, collection) {
        accumulator = noaccum
          ? (noaccum = false, value)
          : callback(accumulator, value, index, collection);
      });
      return accumulator;
    }

    /**
     * The opposite of `_.filter` this method returns the elements of a
     * collection that the callback does **not** return truey for.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that failed the callback check.
     * @example
     *
     * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [1, 3, 5]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.reject(characters, 'blocked');
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     *
     * // using "_.where" callback shorthand
     * _.reject(characters, { 'age': 36 });
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     */
    function reject(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);
      return filter(collection, function(value, index, collection) {
        return !callback(value, index, collection);
      });
    }

    /**
     * Retrieves a random element or `n` random elements from a collection.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to sample.
     * @param {number} [n] The number of elements to sample.
     * @param- {Object} [guard] Allows working with functions like `_.map`
     *  without using their `index` arguments as `n`.
     * @returns {Array} Returns the random sample(s) of `collection`.
     * @example
     *
     * _.sample([1, 2, 3, 4]);
     * // => 2
     *
     * _.sample([1, 2, 3, 4], 2);
     * // => [3, 1]
     */
    function sample(collection, n, guard) {
      if (collection && typeof collection.length != 'number') {
        collection = values(collection);
      }
      if (n == null || guard) {
        return collection ? collection[baseRandom(0, collection.length - 1)] : undefined;
      }
      var result = shuffle(collection);
      result.length = nativeMin(nativeMax(0, n), result.length);
      return result;
    }

    /**
     * Creates an array of shuffled values, using a version of the Fisher-Yates
     * shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to shuffle.
     * @returns {Array} Returns a new shuffled collection.
     * @example
     *
     * _.shuffle([1, 2, 3, 4, 5, 6]);
     * // => [4, 1, 6, 3, 5, 2]
     */
    function shuffle(collection) {
      var index = -1,
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        var rand = baseRandom(0, ++index);
        result[index] = result[rand];
        result[rand] = value;
      });
      return result;
    }

    /**
     * Gets the size of the `collection` by returning `collection.length` for arrays
     * and array-like objects or the number of own enumerable properties for objects.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to inspect.
     * @returns {number} Returns `collection.length` or number of own enumerable properties.
     * @example
     *
     * _.size([1, 2]);
     * // => 2
     *
     * _.size({ 'one': 1, 'two': 2, 'three': 3 });
     * // => 3
     *
     * _.size('pebbles');
     * // => 7
     */
    function size(collection) {
      var length = collection ? collection.length : 0;
      return typeof length == 'number' ? length : keys(collection).length;
    }

    /**
     * Checks if the callback returns a truey value for **any** element of a
     * collection. The function returns as soon as it finds a passing value and
     * does not iterate over the entire collection. The callback is bound to
     * `thisArg` and invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias any
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if any element passed the callback check,
     *  else `false`.
     * @example
     *
     * _.some([null, 0, 'yes', false], Boolean);
     * // => true
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.some(characters, 'blocked');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.some(characters, { 'age': 1 });
     * // => false
     */
    function some(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if ((result = callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return !(result = callback(value, index, collection));
        });
      }
      return !!result;
    }

    /**
     * Creates an array of elements, sorted in ascending order by the results of
     * running each element in a collection through the callback. This method
     * performs a stable sort, that is, it will preserve the original sort order
     * of equal elements. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an array of property names is provided for `callback` the collection
     * will be sorted by each property value.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Array|Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of sorted elements.
     * @example
     *
     * _.sortBy([1, 2, 3], function(num) { return Math.sin(num); });
     * // => [3, 1, 2]
     *
     * _.sortBy([1, 2, 3], function(num) { return this.sin(num); }, Math);
     * // => [3, 1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'barney',  'age': 26 },
     *   { 'name': 'fred',    'age': 30 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(_.sortBy(characters, 'age'), _.values);
     * // => [['barney', 26], ['fred', 30], ['barney', 36], ['fred', 40]]
     *
     * // sorting by multiple properties
     * _.map(_.sortBy(characters, ['name', 'age']), _.values);
     * // = > [['barney', 26], ['barney', 36], ['fred', 30], ['fred', 40]]
     */
    function sortBy(collection, callback, thisArg) {
      var index = -1,
          isArr = isArray(callback),
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      if (!isArr) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      forEach(collection, function(value, key, collection) {
        var object = result[++index] = getObject();
        if (isArr) {
          object.criteria = map(callback, function(key) { return value[key]; });
        } else {
          (object.criteria = getArray())[0] = callback(value, key, collection);
        }
        object.index = index;
        object.value = value;
      });

      length = result.length;
      result.sort(compareAscending);
      while (length--) {
        var object = result[length];
        result[length] = object.value;
        if (!isArr) {
          releaseArray(object.criteria);
        }
        releaseObject(object);
      }
      return result;
    }

    /**
     * Converts the `collection` to an array.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to convert.
     * @returns {Array} Returns the new converted array.
     * @example
     *
     * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
     * // => [2, 3, 4]
     */
    function toArray(collection) {
      if (collection && typeof collection.length == 'number') {
        return slice(collection);
      }
      return values(collection);
    }

    /**
     * Performs a deep comparison of each element in a `collection` to the given
     * `properties` object, returning an array of all elements that have equivalent
     * property values.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Object} props The object of property values to filter by.
     * @returns {Array} Returns a new array of elements that have the given properties.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * _.where(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'pets': ['hoppy'] }]
     *
     * _.where(characters, { 'pets': ['dino'] });
     * // => [{ 'name': 'fred', 'age': 40, 'pets': ['baby puss', 'dino'] }]
     */
    var where = filter;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array with all falsey values removed. The values `false`, `null`,
     * `0`, `""`, `undefined`, and `NaN` are all falsey.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to compact.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.compact([0, 1, false, 2, '', 3]);
     * // => [1, 2, 3]
     */
    function compact(array) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];
        if (value) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Creates an array excluding all values of the provided arrays using strict
     * equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {...Array} [values] The arrays of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
     * // => [1, 3, 4]
     */
    function difference(array) {
      return baseDifference(array, baseFlatten(arguments, true, true, 1));
    }

    /**
     * This method is like `_.find` except that it returns the index of the first
     * element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.findIndex(characters, function(chr) {
     *   return chr.age < 20;
     * });
     * // => 2
     *
     * // using "_.where" callback shorthand
     * _.findIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findIndex(characters, 'blocked');
     * // => 1
     */
    function findIndex(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        if (callback(array[index], index, array)) {
          return index;
        }
      }
      return -1;
    }

    /**
     * This method is like `_.findIndex` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': true },
     *   { 'name': 'fred',    'age': 40, 'blocked': false },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': true }
     * ];
     *
     * _.findLastIndex(characters, function(chr) {
     *   return chr.age > 30;
     * });
     * // => 1
     *
     * // using "_.where" callback shorthand
     * _.findLastIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findLastIndex(characters, 'blocked');
     * // => 2
     */
    function findLastIndex(array, callback, thisArg) {
      var length = array ? array.length : 0;
      callback = lodash.createCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(array[length], length, array)) {
          return length;
        }
      }
      return -1;
    }

    /**
     * Gets the first element or first `n` elements of an array. If a callback
     * is provided elements at the beginning of the array are returned as long
     * as the callback returns truey. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias head, take
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the first element(s) of `array`.
     * @example
     *
     * _.first([1, 2, 3]);
     * // => 1
     *
     * _.first([1, 2, 3], 2);
     * // => [1, 2]
     *
     * _.first([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false, 'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.first(characters, 'blocked');
     * // => [{ 'name': 'barney', 'blocked': true, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.first(characters, { 'employer': 'slate' }), 'name');
     * // => ['barney', 'fred']
     */
    function first(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = -1;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[0] : undefined;
        }
      }
      return slice(array, 0, nativeMin(nativeMax(0, n), length));
    }

    /**
     * Flattens a nested array (the nesting can be to any depth). If `isShallow`
     * is truey, the array will only be flattened a single level. If a callback
     * is provided each element of the array is passed through the callback before
     * flattening. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new flattened array.
     * @example
     *
     * _.flatten([1, [2], [3, [[4]]]]);
     * // => [1, 2, 3, 4];
     *
     * _.flatten([1, [2], [3, [[4]]]], true);
     * // => [1, 2, 3, [[4]]];
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 30, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.flatten(characters, 'pets');
     * // => ['hoppy', 'baby puss', 'dino']
     */
    function flatten(array, isShallow, callback, thisArg) {
      // juggle arguments
      if (typeof isShallow != 'boolean' && isShallow != null) {
        thisArg = callback;
        callback = (typeof isShallow != 'function' && thisArg && thisArg[isShallow] === array) ? null : isShallow;
        isShallow = false;
      }
      if (callback != null) {
        array = map(array, callback, thisArg);
      }
      return baseFlatten(array, isShallow);
    }

    /**
     * Gets the index at which the first occurrence of `value` is found using
     * strict equality for comparisons, i.e. `===`. If the array is already sorted
     * providing `true` for `fromIndex` will run a faster binary search.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {boolean|number} [fromIndex=0] The index to search from or `true`
     *  to perform a binary search on a sorted array.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 1
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 4
     *
     * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
     * // => 2
     */
    function indexOf(array, value, fromIndex) {
      if (typeof fromIndex == 'number') {
        var length = array ? array.length : 0;
        fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0);
      } else if (fromIndex) {
        var index = sortedIndex(array, value);
        return array[index] === value ? index : -1;
      }
      return baseIndexOf(array, value, fromIndex);
    }

    /**
     * Gets all but the last element or last `n` elements of an array. If a
     * callback is provided elements at the end of the array are excluded from
     * the result as long as the callback returns truey. The callback is bound
     * to `thisArg` and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.initial([1, 2, 3]);
     * // => [1, 2]
     *
     * _.initial([1, 2, 3], 2);
     * // => [1]
     *
     * _.initial([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [1]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.initial(characters, 'blocked');
     * // => [{ 'name': 'barney',  'blocked': false, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.initial(characters, { 'employer': 'na' }), 'name');
     * // => ['barney', 'fred']
     */
    function initial(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : callback || n;
      }
      return slice(array, 0, nativeMin(nativeMax(0, length - n), length));
    }

    /**
     * Creates an array of unique values present in all provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of shared values.
     * @example
     *
     * _.intersection([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2]
     */
    function intersection() {
      var args = [],
          argsIndex = -1,
          argsLength = arguments.length,
          caches = getArray(),
          indexOf = getIndexOf(),
          trustIndexOf = indexOf === baseIndexOf,
          seen = getArray();

      while (++argsIndex < argsLength) {
        var value = arguments[argsIndex];
        if (isArray(value) || isArguments(value)) {
          args.push(value);
          caches.push(trustIndexOf && value.length >= largeArraySize &&
            createCache(argsIndex ? args[argsIndex] : seen));
        }
      }
      var array = args[0],
          index = -1,
          length = array ? array.length : 0,
          result = [];

      outer:
      while (++index < length) {
        var cache = caches[0];
        value = array[index];

        if ((cache ? cacheIndexOf(cache, value) : indexOf(seen, value)) < 0) {
          argsIndex = argsLength;
          (cache || seen).push(value);
          while (--argsIndex) {
            cache = caches[argsIndex];
            if ((cache ? cacheIndexOf(cache, value) : indexOf(args[argsIndex], value)) < 0) {
              continue outer;
            }
          }
          result.push(value);
        }
      }
      while (argsLength--) {
        cache = caches[argsLength];
        if (cache) {
          releaseObject(cache);
        }
      }
      releaseArray(caches);
      releaseArray(seen);
      return result;
    }

    /**
     * Gets the last element or last `n` elements of an array. If a callback is
     * provided elements at the end of the array are returned as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the last element(s) of `array`.
     * @example
     *
     * _.last([1, 2, 3]);
     * // => 3
     *
     * _.last([1, 2, 3], 2);
     * // => [2, 3]
     *
     * _.last([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [2, 3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.last(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.last(characters, { 'employer': 'na' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function last(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[length - 1] : undefined;
        }
      }
      return slice(array, nativeMax(0, length - n));
    }

    /**
     * Gets the index at which the last occurrence of `value` is found using strict
     * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
     * as the offset from the end of the collection.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {number} [fromIndex=array.length-1] The index to search from.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 4
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 1
     */
    function lastIndexOf(array, value, fromIndex) {
      var index = array ? array.length : 0;
      if (typeof fromIndex == 'number') {
        index = (fromIndex < 0 ? nativeMax(0, index + fromIndex) : nativeMin(fromIndex, index - 1)) + 1;
      }
      while (index--) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }

    /**
     * Removes all provided values from the given array using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {...*} [value] The values to remove.
     * @returns {Array} Returns `array`.
     * @example
     *
     * var array = [1, 2, 3, 1, 2, 3];
     * _.pull(array, 2, 3);
     * console.log(array);
     * // => [1, 1]
     */
    function pull(array) {
      var args = arguments,
          argsIndex = 0,
          argsLength = args.length,
          length = array ? array.length : 0;

      while (++argsIndex < argsLength) {
        var index = -1,
            value = args[argsIndex];
        while (++index < length) {
          if (array[index] === value) {
            splice.call(array, index--, 1);
            length--;
          }
        }
      }
      return array;
    }

    /**
     * Creates an array of numbers (positive and/or negative) progressing from
     * `start` up to but not including `end`. If `start` is less than `stop` a
     * zero-length range is created unless a negative `step` is specified.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {number} [start=0] The start of the range.
     * @param {number} end The end of the range.
     * @param {number} [step=1] The value to increment or decrement by.
     * @returns {Array} Returns a new range array.
     * @example
     *
     * _.range(4);
     * // => [0, 1, 2, 3]
     *
     * _.range(1, 5);
     * // => [1, 2, 3, 4]
     *
     * _.range(0, 20, 5);
     * // => [0, 5, 10, 15]
     *
     * _.range(0, -4, -1);
     * // => [0, -1, -2, -3]
     *
     * _.range(1, 4, 0);
     * // => [1, 1, 1]
     *
     * _.range(0);
     * // => []
     */
    function range(start, end, step) {
      start = +start || 0;
      step = typeof step == 'number' ? step : (+step || 1);

      if (end == null) {
        end = start;
        start = 0;
      }
      // use `Array(length)` so engines like Chakra and V8 avoid slower modes
      // http://youtu.be/XAqIpGU8ZZk#t=17m25s
      var index = -1,
          length = nativeMax(0, ceil((end - start) / (step || 1))),
          result = Array(length);

      while (++index < length) {
        result[index] = start;
        start += step;
      }
      return result;
    }

    /**
     * Removes all elements from an array that the callback returns truey for
     * and returns an array of removed elements. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of removed elements.
     * @example
     *
     * var array = [1, 2, 3, 4, 5, 6];
     * var evens = _.remove(array, function(num) { return num % 2 == 0; });
     *
     * console.log(array);
     * // => [1, 3, 5]
     *
     * console.log(evens);
     * // => [2, 4, 6]
     */
    function remove(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        var value = array[index];
        if (callback(value, index, array)) {
          result.push(value);
          splice.call(array, index--, 1);
          length--;
        }
      }
      return result;
    }

    /**
     * The opposite of `_.initial` this method gets all but the first element or
     * first `n` elements of an array. If a callback function is provided elements
     * at the beginning of the array are excluded from the result as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias drop, tail
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.rest([1, 2, 3]);
     * // => [2, 3]
     *
     * _.rest([1, 2, 3], 2);
     * // => [3]
     *
     * _.rest([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true, 'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.rest(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.rest(characters, { 'employer': 'slate' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function rest(array, callback, thisArg) {
      if (typeof callback != 'number' && callback != null) {
        var n = 0,
            index = -1,
            length = array ? array.length : 0;

        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : nativeMax(0, callback);
      }
      return slice(array, n);
    }

    /**
     * Uses a binary search to determine the smallest index at which a value
     * should be inserted into a given sorted array in order to maintain the sort
     * order of the array. If a callback is provided it will be executed for
     * `value` and each element of `array` to compute their sort ranking. The
     * callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to inspect.
     * @param {*} value The value to evaluate.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index at which `value` should be inserted
     *  into `array`.
     * @example
     *
     * _.sortedIndex([20, 30, 50], 40);
     * // => 2
     *
     * // using "_.pluck" callback shorthand
     * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
     * // => 2
     *
     * var dict = {
     *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
     * };
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return dict.wordToNumber[word];
     * });
     * // => 2
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return this.wordToNumber[word];
     * }, dict);
     * // => 2
     */
    function sortedIndex(array, value, callback, thisArg) {
      var low = 0,
          high = array ? array.length : low;

      // explicitly reference `identity` for better inlining in Firefox
      callback = callback ? lodash.createCallback(callback, thisArg, 1) : identity;
      value = callback(value);

      while (low < high) {
        var mid = (low + high) >>> 1;
        (callback(array[mid]) < value)
          ? low = mid + 1
          : high = mid;
      }
      return low;
    }

    /**
     * Creates an array of unique values, in order, of the provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of combined values.
     * @example
     *
     * _.union([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2, 3, 5, 4]
     */
    function union() {
      return baseUniq(baseFlatten(arguments, true, true));
    }

    /**
     * Creates a duplicate-value-free version of an array using strict equality
     * for comparisons, i.e. `===`. If the array is sorted, providing
     * `true` for `isSorted` will use a faster algorithm. If a callback is provided
     * each element of `array` is passed through the callback before uniqueness
     * is computed. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias unique
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a duplicate-value-free array.
     * @example
     *
     * _.uniq([1, 2, 1, 3, 1]);
     * // => [1, 2, 3]
     *
     * _.uniq([1, 1, 2, 2, 3], true);
     * // => [1, 2, 3]
     *
     * _.uniq(['A', 'b', 'C', 'a', 'B', 'c'], function(letter) { return letter.toLowerCase(); });
     * // => ['A', 'b', 'C']
     *
     * _.uniq([1, 2.5, 3, 1.5, 2, 3.5], function(num) { return this.floor(num); }, Math);
     * // => [1, 2.5, 3]
     *
     * // using "_.pluck" callback shorthand
     * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 1 }, { 'x': 2 }]
     */
    function uniq(array, isSorted, callback, thisArg) {
      // juggle arguments
      if (typeof isSorted != 'boolean' && isSorted != null) {
        thisArg = callback;
        callback = (typeof isSorted != 'function' && thisArg && thisArg[isSorted] === array) ? null : isSorted;
        isSorted = false;
      }
      if (callback != null) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      return baseUniq(array, isSorted, callback);
    }

    /**
     * Creates an array excluding all provided values using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to filter.
     * @param {...*} [value] The values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
     * // => [2, 3, 4]
     */
    function without(array) {
      return baseDifference(array, slice(arguments, 1));
    }

    /**
     * Creates an array that is the symmetric difference of the provided arrays.
     * See http://en.wikipedia.org/wiki/Symmetric_difference.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of values.
     * @example
     *
     * _.xor([1, 2, 3], [5, 2, 1, 4]);
     * // => [3, 5, 4]
     *
     * _.xor([1, 2, 5], [2, 3, 5], [3, 4, 5]);
     * // => [1, 4, 5]
     */
    function xor() {
      var index = -1,
          length = arguments.length;

      while (++index < length) {
        var array = arguments[index];
        if (isArray(array) || isArguments(array)) {
          var result = result
            ? baseUniq(baseDifference(result, array).concat(baseDifference(array, result)))
            : array;
        }
      }
      return result || [];
    }

    /**
     * Creates an array of grouped elements, the first of which contains the first
     * elements of the given arrays, the second of which contains the second
     * elements of the given arrays, and so on.
     *
     * @static
     * @memberOf _
     * @alias unzip
     * @category Arrays
     * @param {...Array} [array] Arrays to process.
     * @returns {Array} Returns a new array of grouped elements.
     * @example
     *
     * _.zip(['fred', 'barney'], [30, 40], [true, false]);
     * // => [['fred', 30, true], ['barney', 40, false]]
     */
    function zip() {
      var array = arguments.length > 1 ? arguments : arguments[0],
          index = -1,
          length = array ? max(pluck(array, 'length')) : 0,
          result = Array(length < 0 ? 0 : length);

      while (++index < length) {
        result[index] = pluck(array, index);
      }
      return result;
    }

    /**
     * Creates an object composed from arrays of `keys` and `values`. Provide
     * either a single two dimensional array, i.e. `[[key1, value1], [key2, value2]]`
     * or two arrays, one of `keys` and one of corresponding `values`.
     *
     * @static
     * @memberOf _
     * @alias object
     * @category Arrays
     * @param {Array} keys The array of keys.
     * @param {Array} [values=[]] The array of values.
     * @returns {Object} Returns an object composed of the given keys and
     *  corresponding values.
     * @example
     *
     * _.zipObject(['fred', 'barney'], [30, 40]);
     * // => { 'fred': 30, 'barney': 40 }
     */
    function zipObject(keys, values) {
      var index = -1,
          length = keys ? keys.length : 0,
          result = {};

      if (!values && length && !isArray(keys[0])) {
        values = [];
      }
      while (++index < length) {
        var key = keys[index];
        if (values) {
          result[key] = values[index];
        } else if (key) {
          result[key[0]] = key[1];
        }
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that executes `func`, with  the `this` binding and
     * arguments of the created function, only after being called `n` times.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {number} n The number of times the function must be called before
     *  `func` is executed.
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var saves = ['profile', 'settings'];
     *
     * var done = _.after(saves.length, function() {
     *   console.log('Done saving!');
     * });
     *
     * _.forEach(saves, function(type) {
     *   asyncSave({ 'type': type, 'complete': done });
     * });
     * // => logs 'Done saving!', after all saves have completed
     */
    function after(n, func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (--n < 1) {
          return func.apply(this, arguments);
        }
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with the `this`
     * binding of `thisArg` and prepends any additional `bind` arguments to those
     * provided to the bound function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to bind.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var func = function(greeting) {
     *   return greeting + ' ' + this.name;
     * };
     *
     * func = _.bind(func, { 'name': 'fred' }, 'hi');
     * func();
     * // => 'hi fred'
     */
    function bind(func, thisArg) {
      return arguments.length > 2
        ? createWrapper(func, 17, slice(arguments, 2), null, thisArg)
        : createWrapper(func, 1, null, null, thisArg);
    }

    /**
     * Binds methods of an object to the object itself, overwriting the existing
     * method. Method names may be specified as individual arguments or as arrays
     * of method names. If no method names are provided all the function properties
     * of `object` will be bound.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object to bind and assign the bound methods to.
     * @param {...string} [methodName] The object method names to
     *  bind, specified as individual method names or arrays of method names.
     * @returns {Object} Returns `object`.
     * @example
     *
     * var view = {
     *   'label': 'docs',
     *   'onClick': function() { console.log('clicked ' + this.label); }
     * };
     *
     * _.bindAll(view);
     * jQuery('#docs').on('click', view.onClick);
     * // => logs 'clicked docs', when the button is clicked
     */
    function bindAll(object) {
      var funcs = arguments.length > 1 ? baseFlatten(arguments, true, false, 1) : functions(object),
          index = -1,
          length = funcs.length;

      while (++index < length) {
        var key = funcs[index];
        object[key] = createWrapper(object[key], 1, null, null, object);
      }
      return object;
    }

    /**
     * Creates a function that, when called, invokes the method at `object[key]`
     * and prepends any additional `bindKey` arguments to those provided to the bound
     * function. This method differs from `_.bind` by allowing bound functions to
     * reference methods that will be redefined or don't yet exist.
     * See http://michaux.ca/articles/lazy-function-definition-pattern.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object the method belongs to.
     * @param {string} key The key of the method.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var object = {
     *   'name': 'fred',
     *   'greet': function(greeting) {
     *     return greeting + ' ' + this.name;
     *   }
     * };
     *
     * var func = _.bindKey(object, 'greet', 'hi');
     * func();
     * // => 'hi fred'
     *
     * object.greet = function(greeting) {
     *   return greeting + 'ya ' + this.name + '!';
     * };
     *
     * func();
     * // => 'hiya fred!'
     */
    function bindKey(object, key) {
      return arguments.length > 2
        ? createWrapper(key, 19, slice(arguments, 2), null, object)
        : createWrapper(key, 3, null, null, object);
    }

    /**
     * Creates a function that is the composition of the provided functions,
     * where each function consumes the return value of the function that follows.
     * For example, composing the functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
     * Each function is executed with the `this` binding of the composed function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {...Function} [func] Functions to compose.
     * @returns {Function} Returns the new composed function.
     * @example
     *
     * var realNameMap = {
     *   'pebbles': 'penelope'
     * };
     *
     * var format = function(name) {
     *   name = realNameMap[name.toLowerCase()] || name;
     *   return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
     * };
     *
     * var greet = function(formatted) {
     *   return 'Hiya ' + formatted + '!';
     * };
     *
     * var welcome = _.compose(greet, format);
     * welcome('pebbles');
     * // => 'Hiya Penelope!'
     */
    function compose() {
      var funcs = arguments,
          length = funcs.length;

      while (length--) {
        if (!isFunction(funcs[length])) {
          throw new TypeError;
        }
      }
      return function() {
        var args = arguments,
            length = funcs.length;

        while (length--) {
          args = [funcs[length].apply(this, args)];
        }
        return args[0];
      };
    }

    /**
     * Creates a function which accepts one or more arguments of `func` that when
     * invoked either executes `func` returning its result, if all `func` arguments
     * have been provided, or returns a function that accepts one or more of the
     * remaining `func` arguments, and so on. The arity of `func` can be specified
     * if `func.length` is not sufficient.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to curry.
     * @param {number} [arity=func.length] The arity of `func`.
     * @returns {Function} Returns the new curried function.
     * @example
     *
     * var curried = _.curry(function(a, b, c) {
     *   console.log(a + b + c);
     * });
     *
     * curried(1)(2)(3);
     * // => 6
     *
     * curried(1, 2)(3);
     * // => 6
     *
     * curried(1, 2, 3);
     * // => 6
     */
    function curry(func, arity) {
      arity = typeof arity == 'number' ? arity : (+arity || func.length);
      return createWrapper(func, 4, null, null, null, arity);
    }

    /**
     * Creates a function that will delay the execution of `func` until after
     * `wait` milliseconds have elapsed since the last time it was invoked.
     * Provide an options object to indicate that `func` should be invoked on
     * the leading and/or trailing edge of the `wait` timeout. Subsequent calls
     * to the debounced function will return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the debounced function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to debounce.
     * @param {number} wait The number of milliseconds to delay.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=false] Specify execution on the leading edge of the timeout.
     * @param {number} [options.maxWait] The maximum time `func` is allowed to be delayed before it's called.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new debounced function.
     * @example
     *
     * // avoid costly calculations while the window size is in flux
     * var lazyLayout = _.debounce(calculateLayout, 150);
     * jQuery(window).on('resize', lazyLayout);
     *
     * // execute `sendMail` when the click event is fired, debouncing subsequent calls
     * jQuery('#postbox').on('click', _.debounce(sendMail, 300, {
     *   'leading': true,
     *   'trailing': false
     * });
     *
     * // ensure `batchLog` is executed once after 1 second of debounced calls
     * var source = new EventSource('/stream');
     * source.addEventListener('message', _.debounce(batchLog, 250, {
     *   'maxWait': 1000
     * }, false);
     */
    function debounce(func, wait, options) {
      var args,
          maxTimeoutId,
          result,
          stamp,
          thisArg,
          timeoutId,
          trailingCall,
          lastCalled = 0,
          maxWait = false,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      wait = nativeMax(0, wait) || 0;
      if (options === true) {
        var leading = true;
        trailing = false;
      } else if (isObject(options)) {
        leading = options.leading;
        maxWait = 'maxWait' in options && (nativeMax(wait, options.maxWait) || 0);
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      var delayed = function() {
        var remaining = wait - (now() - stamp);
        if (remaining <= 0) {
          if (maxTimeoutId) {
            clearTimeout(maxTimeoutId);
          }
          var isCalled = trailingCall;
          maxTimeoutId = timeoutId = trailingCall = undefined;
          if (isCalled) {
            lastCalled = now();
            result = func.apply(thisArg, args);
            if (!timeoutId && !maxTimeoutId) {
              args = thisArg = null;
            }
          }
        } else {
          timeoutId = setTimeout(delayed, remaining);
        }
      };

      var maxDelayed = function() {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        maxTimeoutId = timeoutId = trailingCall = undefined;
        if (trailing || (maxWait !== wait)) {
          lastCalled = now();
          result = func.apply(thisArg, args);
          if (!timeoutId && !maxTimeoutId) {
            args = thisArg = null;
          }
        }
      };

      return function() {
        args = arguments;
        stamp = now();
        thisArg = this;
        trailingCall = trailing && (timeoutId || !leading);

        if (maxWait === false) {
          var leadingCall = leading && !timeoutId;
        } else {
          if (!maxTimeoutId && !leading) {
            lastCalled = stamp;
          }
          var remaining = maxWait - (stamp - lastCalled),
              isCalled = remaining <= 0;

          if (isCalled) {
            if (maxTimeoutId) {
              maxTimeoutId = clearTimeout(maxTimeoutId);
            }
            lastCalled = stamp;
            result = func.apply(thisArg, args);
          }
          else if (!maxTimeoutId) {
            maxTimeoutId = setTimeout(maxDelayed, remaining);
          }
        }
        if (isCalled && timeoutId) {
          timeoutId = clearTimeout(timeoutId);
        }
        else if (!timeoutId && wait !== maxWait) {
          timeoutId = setTimeout(delayed, wait);
        }
        if (leadingCall) {
          isCalled = true;
          result = func.apply(thisArg, args);
        }
        if (isCalled && !timeoutId && !maxTimeoutId) {
          args = thisArg = null;
        }
        return result;
      };
    }

    /**
     * Defers executing the `func` function until the current call stack has cleared.
     * Additional arguments will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to defer.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.defer(function(text) { console.log(text); }, 'deferred');
     * // logs 'deferred' after one or more milliseconds
     */
    function defer(func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 1);
      return setTimeout(function() { func.apply(undefined, args); }, 1);
    }

    /**
     * Executes the `func` function after `wait` milliseconds. Additional arguments
     * will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to delay.
     * @param {number} wait The number of milliseconds to delay execution.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.delay(function(text) { console.log(text); }, 1000, 'later');
     * // => logs 'later' after one second
     */
    function delay(func, wait) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 2);
      return setTimeout(function() { func.apply(undefined, args); }, wait);
    }

    /**
     * Creates a function that memoizes the result of `func`. If `resolver` is
     * provided it will be used to determine the cache key for storing the result
     * based on the arguments provided to the memoized function. By default, the
     * first argument provided to the memoized function is used as the cache key.
     * The `func` is executed with the `this` binding of the memoized function.
     * The result cache is exposed as the `cache` property on the memoized function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to have its output memoized.
     * @param {Function} [resolver] A function used to resolve the cache key.
     * @returns {Function} Returns the new memoizing function.
     * @example
     *
     * var fibonacci = _.memoize(function(n) {
     *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
     * });
     *
     * fibonacci(9)
     * // => 34
     *
     * var data = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // modifying the result cache
     * var get = _.memoize(function(name) { return data[name]; }, _.identity);
     * get('pebbles');
     * // => { 'name': 'pebbles', 'age': 1 }
     *
     * get.cache.pebbles.name = 'penelope';
     * get('pebbles');
     * // => { 'name': 'penelope', 'age': 1 }
     */
    function memoize(func, resolver) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var memoized = function() {
        var cache = memoized.cache,
            key = resolver ? resolver.apply(this, arguments) : keyPrefix + arguments[0];

        return hasOwnProperty.call(cache, key)
          ? cache[key]
          : (cache[key] = func.apply(this, arguments));
      }
      memoized.cache = {};
      return memoized;
    }

    /**
     * Creates a function that is restricted to execute `func` once. Repeat calls to
     * the function will return the value of the first call. The `func` is executed
     * with the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var initialize = _.once(createApplication);
     * initialize();
     * initialize();
     * // `initialize` executes `createApplication` once
     */
    function once(func) {
      var ran,
          result;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (ran) {
          return result;
        }
        ran = true;
        result = func.apply(this, arguments);

        // clear the `func` variable so the function may be garbage collected
        func = null;
        return result;
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with any additional
     * `partial` arguments prepended to those provided to the new function. This
     * method is similar to `_.bind` except it does **not** alter the `this` binding.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var greet = function(greeting, name) { return greeting + ' ' + name; };
     * var hi = _.partial(greet, 'hi');
     * hi('fred');
     * // => 'hi fred'
     */
    function partial(func) {
      return createWrapper(func, 16, slice(arguments, 1));
    }

    /**
     * This method is like `_.partial` except that `partial` arguments are
     * appended to those provided to the new function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var defaultsDeep = _.partialRight(_.merge, _.defaults);
     *
     * var options = {
     *   'variable': 'data',
     *   'imports': { 'jq': $ }
     * };
     *
     * defaultsDeep(options, _.templateSettings);
     *
     * options.variable
     * // => 'data'
     *
     * options.imports
     * // => { '_': _, 'jq': $ }
     */
    function partialRight(func) {
      return createWrapper(func, 32, null, slice(arguments, 1));
    }

    /**
     * Creates a function that, when executed, will only call the `func` function
     * at most once per every `wait` milliseconds. Provide an options object to
     * indicate that `func` should be invoked on the leading and/or trailing edge
     * of the `wait` timeout. Subsequent calls to the throttled function will
     * return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the throttled function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to throttle.
     * @param {number} wait The number of milliseconds to throttle executions to.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=true] Specify execution on the leading edge of the timeout.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new throttled function.
     * @example
     *
     * // avoid excessively updating the position while scrolling
     * var throttled = _.throttle(updatePosition, 100);
     * jQuery(window).on('scroll', throttled);
     *
     * // execute `renewToken` when the click event is fired, but not more than once every 5 minutes
     * jQuery('.interactive').on('click', _.throttle(renewToken, 300000, {
     *   'trailing': false
     * }));
     */
    function throttle(func, wait, options) {
      var leading = true,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      if (options === false) {
        leading = false;
      } else if (isObject(options)) {
        leading = 'leading' in options ? options.leading : leading;
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      debounceOptions.leading = leading;
      debounceOptions.maxWait = wait;
      debounceOptions.trailing = trailing;

      return debounce(func, wait, debounceOptions);
    }

    /**
     * Creates a function that provides `value` to the wrapper function as its
     * first argument. Additional arguments provided to the function are appended
     * to those provided to the wrapper function. The wrapper is executed with
     * the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {*} value The value to wrap.
     * @param {Function} wrapper The wrapper function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var p = _.wrap(_.escape, function(func, text) {
     *   return '<p>' + func(text) + '</p>';
     * });
     *
     * p('Fred, Wilma, & Pebbles');
     * // => '<p>Fred, Wilma, &amp; Pebbles</p>'
     */
    function wrap(value, wrapper) {
      return createWrapper(wrapper, 16, [value]);
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that returns `value`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value The value to return from the new function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var getter = _.constant(object);
     * getter() === object;
     * // => true
     */
    function constant(value) {
      return function() {
        return value;
      };
    }

    /**
     * Produces a callback bound to an optional `thisArg`. If `func` is a property
     * name the created callback will return the property value for a given element.
     * If `func` is an object the created callback will return `true` for elements
     * that contain the equivalent object properties, otherwise it will return `false`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // wrap to create custom callback shorthands
     * _.createCallback = _.wrap(_.createCallback, function(func, callback, thisArg) {
     *   var match = /^(.+?)__([gl]t)(.+)$/.exec(callback);
     *   return !match ? func(callback, thisArg) : function(object) {
     *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
     *   };
     * });
     *
     * _.filter(characters, 'age__gt38');
     * // => [{ 'name': 'fred', 'age': 40 }]
     */
    function createCallback(func, thisArg, argCount) {
      var type = typeof func;
      if (func == null || type == 'function') {
        return baseCreateCallback(func, thisArg, argCount);
      }
      // handle "_.pluck" style callback shorthands
      if (type != 'object') {
        return property(func);
      }
      var props = keys(func),
          key = props[0],
          a = func[key];

      // handle "_.where" style callback shorthands
      if (props.length == 1 && a === a && !isObject(a)) {
        // fast path the common case of providing an object with a single
        // property containing a primitive value
        return function(object) {
          var b = object[key];
          return a === b && (a !== 0 || (1 / a == 1 / b));
        };
      }
      return function(object) {
        var length = props.length,
            result = false;

        while (length--) {
          if (!(result = baseIsEqual(object[props[length]], func[props[length]], null, true))) {
            break;
          }
        }
        return result;
      };
    }

    /**
     * Converts the characters `&`, `<`, `>`, `"`, and `'` in `string` to their
     * corresponding HTML entities.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to escape.
     * @returns {string} Returns the escaped string.
     * @example
     *
     * _.escape('Fred, Wilma, & Pebbles');
     * // => 'Fred, Wilma, &amp; Pebbles'
     */
    function escape(string) {
      return string == null ? '' : String(string).replace(reUnescapedHtml, escapeHtmlChar);
    }

    /**
     * This method returns the first argument provided to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value Any value.
     * @returns {*} Returns `value`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.identity(object) === object;
     * // => true
     */
    function identity(value) {
      return value;
    }

    /**
     * Adds function properties of a source object to the destination object.
     * If `object` is a function methods will be added to its prototype as well.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Function|Object} [object=lodash] object The destination object.
     * @param {Object} source The object of functions to add.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.chain=true] Specify whether the functions added are chainable.
     * @example
     *
     * function capitalize(string) {
     *   return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
     * }
     *
     * _.mixin({ 'capitalize': capitalize });
     * _.capitalize('fred');
     * // => 'Fred'
     *
     * _('fred').capitalize().value();
     * // => 'Fred'
     *
     * _.mixin({ 'capitalize': capitalize }, { 'chain': false });
     * _('fred').capitalize();
     * // => 'Fred'
     */
    function mixin(object, source, options) {
      var chain = true,
          methodNames = source && functions(source);

      if (!source || (!options && !methodNames.length)) {
        if (options == null) {
          options = source;
        }
        ctor = lodashWrapper;
        source = object;
        object = lodash;
        methodNames = functions(source);
      }
      if (options === false) {
        chain = false;
      } else if (isObject(options) && 'chain' in options) {
        chain = options.chain;
      }
      var ctor = object,
          isFunc = isFunction(ctor);

      forEach(methodNames, function(methodName) {
        var func = object[methodName] = source[methodName];
        if (isFunc) {
          ctor.prototype[methodName] = function() {
            var chainAll = this.__chain__,
                value = this.__wrapped__,
                args = [value];

            push.apply(args, arguments);
            var result = func.apply(object, args);
            if (chain || chainAll) {
              if (value === result && isObject(result)) {
                return this;
              }
              result = new ctor(result);
              result.__chain__ = chainAll;
            }
            return result;
          };
        }
      });
    }

    /**
     * Reverts the '_' variable to its previous value and returns a reference to
     * the `lodash` function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @returns {Function} Returns the `lodash` function.
     * @example
     *
     * var lodash = _.noConflict();
     */
    function noConflict() {
      context._ = oldDash;
      return this;
    }

    /**
     * A no-operation function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.noop(object) === undefined;
     * // => true
     */
    function noop() {
      // no operation performed
    }

    /**
     * Gets the number of milliseconds that have elapsed since the Unix epoch
     * (1 January 1970 00:00:00 UTC).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var stamp = _.now();
     * _.defer(function() { console.log(_.now() - stamp); });
     * // => logs the number of milliseconds it took for the deferred function to be called
     */
    var now = isNative(now = Date.now) && now || function() {
      return new Date().getTime();
    };

    /**
     * Converts the given value into an integer of the specified radix.
     * If `radix` is `undefined` or `0` a `radix` of `10` is used unless the
     * `value` is a hexadecimal, in which case a `radix` of `16` is used.
     *
     * Note: This method avoids differences in native ES3 and ES5 `parseInt`
     * implementations. See http://es5.github.io/#E.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} value The value to parse.
     * @param {number} [radix] The radix used to interpret the value to parse.
     * @returns {number} Returns the new integer value.
     * @example
     *
     * _.parseInt('08');
     * // => 8
     */
    var parseInt = nativeParseInt(whitespace + '08') == 8 ? nativeParseInt : function(value, radix) {
      // Firefox < 21 and Opera < 15 follow the ES3 specified implementation of `parseInt`
      return nativeParseInt(isString(value) ? value.replace(reLeadingSpacesAndZeros, '') : value, radix || 0);
    };

    /**
     * Creates a "_.pluck" style function, which returns the `key` value of a
     * given object.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} key The name of the property to retrieve.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var characters = [
     *   { 'name': 'fred',   'age': 40 },
     *   { 'name': 'barney', 'age': 36 }
     * ];
     *
     * var getName = _.property('name');
     *
     * _.map(characters, getName);
     * // => ['barney', 'fred']
     *
     * _.sortBy(characters, getName);
     * // => [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred',   'age': 40 }]
     */
    function property(key) {
      return function(object) {
        return object[key];
      };
    }

    /**
     * Produces a random number between `min` and `max` (inclusive). If only one
     * argument is provided a number between `0` and the given number will be
     * returned. If `floating` is truey or either `min` or `max` are floats a
     * floating-point number will be returned instead of an integer.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} [min=0] The minimum possible value.
     * @param {number} [max=1] The maximum possible value.
     * @param {boolean} [floating=false] Specify returning a floating-point number.
     * @returns {number} Returns a random number.
     * @example
     *
     * _.random(0, 5);
     * // => an integer between 0 and 5
     *
     * _.random(5);
     * // => also an integer between 0 and 5
     *
     * _.random(5, true);
     * // => a floating-point number between 0 and 5
     *
     * _.random(1.2, 5.2);
     * // => a floating-point number between 1.2 and 5.2
     */
    function random(min, max, floating) {
      var noMin = min == null,
          noMax = max == null;

      if (floating == null) {
        if (typeof min == 'boolean' && noMax) {
          floating = min;
          min = 1;
        }
        else if (!noMax && typeof max == 'boolean') {
          floating = max;
          noMax = true;
        }
      }
      if (noMin && noMax) {
        max = 1;
      }
      min = +min || 0;
      if (noMax) {
        max = min;
        min = 0;
      } else {
        max = +max || 0;
      }
      if (floating || min % 1 || max % 1) {
        var rand = nativeRandom();
        return nativeMin(min + (rand * (max - min + parseFloat('1e-' + ((rand +'').length - 1)))), max);
      }
      return baseRandom(min, max);
    }

    /**
     * Resolves the value of property `key` on `object`. If `key` is a function
     * it will be invoked with the `this` binding of `object` and its result returned,
     * else the property value is returned. If `object` is falsey then `undefined`
     * is returned.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to resolve.
     * @returns {*} Returns the resolved value.
     * @example
     *
     * var object = {
     *   'cheese': 'crumpets',
     *   'stuff': function() {
     *     return 'nonsense';
     *   }
     * };
     *
     * _.result(object, 'cheese');
     * // => 'crumpets'
     *
     * _.result(object, 'stuff');
     * // => 'nonsense'
     */
    function result(object, key) {
      if (object) {
        var value = object[key];
        return isFunction(value) ? object[key]() : value;
      }
    }

    /**
     * A micro-templating method that handles arbitrary delimiters, preserves
     * whitespace, and correctly escapes quotes within interpolated code.
     *
     * Note: In the development build, `_.template` utilizes sourceURLs for easier
     * debugging. See http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
     *
     * For more information on precompiling templates see:
     * http://lodash.com/custom-builds
     *
     * For more information on Chrome extension sandboxes see:
     * http://developer.chrome.com/stable/extensions/sandboxingEval.html
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} text The template text.
     * @param {Object} data The data object used to populate the text.
     * @param {Object} [options] The options object.
     * @param {RegExp} [options.escape] The "escape" delimiter.
     * @param {RegExp} [options.evaluate] The "evaluate" delimiter.
     * @param {Object} [options.imports] An object to import into the template as local variables.
     * @param {RegExp} [options.interpolate] The "interpolate" delimiter.
     * @param {string} [sourceURL] The sourceURL of the template's compiled source.
     * @param {string} [variable] The data object variable name.
     * @returns {Function|string} Returns a compiled function when no `data` object
     *  is given, else it returns the interpolated text.
     * @example
     *
     * // using the "interpolate" delimiter to create a compiled template
     * var compiled = _.template('hello <%= name %>');
     * compiled({ 'name': 'fred' });
     * // => 'hello fred'
     *
     * // using the "escape" delimiter to escape HTML in data property values
     * _.template('<b><%- value %></b>', { 'value': '<script>' });
     * // => '<b>&lt;script&gt;</b>'
     *
     * // using the "evaluate" delimiter to generate HTML
     * var list = '<% _.forEach(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the ES6 delimiter as an alternative to the default "interpolate" delimiter
     * _.template('hello ${ name }', { 'name': 'pebbles' });
     * // => 'hello pebbles'
     *
     * // using the internal `print` function in "evaluate" delimiters
     * _.template('<% print("hello " + name); %>!', { 'name': 'barney' });
     * // => 'hello barney!'
     *
     * // using a custom template delimiters
     * _.templateSettings = {
     *   'interpolate': /{{([\s\S]+?)}}/g
     * };
     *
     * _.template('hello {{ name }}!', { 'name': 'mustache' });
     * // => 'hello mustache!'
     *
     * // using the `imports` option to import jQuery
     * var list = '<% jq.each(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] }, { 'imports': { 'jq': jQuery } });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the `sourceURL` option to specify a custom sourceURL for the template
     * var compiled = _.template('hello <%= name %>', null, { 'sourceURL': '/basic/greeting.jst' });
     * compiled(data);
     * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
     *
     * // using the `variable` option to ensure a with-statement isn't used in the compiled template
     * var compiled = _.template('hi <%= data.name %>!', null, { 'variable': 'data' });
     * compiled.source;
     * // => function(data) {
     *   var __t, __p = '', __e = _.escape;
     *   __p += 'hi ' + ((__t = ( data.name )) == null ? '' : __t) + '!';
     *   return __p;
     * }
     *
     * // using the `source` property to inline compiled templates for meaningful
     * // line numbers in error messages and a stack trace
     * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
     *   var JST = {\
     *     "main": ' + _.template(mainText).source + '\
     *   };\
     * ');
     */
    function template(text, data, options) {
      // based on John Resig's `tmpl` implementation
      // http://ejohn.org/blog/javascript-micro-templating/
      // and Laura Doktorova's doT.js
      // https://github.com/olado/doT
      var settings = lodash.templateSettings;
      text = String(text || '');

      // avoid missing dependencies when `iteratorTemplate` is not defined
      options = defaults({}, options, settings);

      var imports = defaults({}, options.imports, settings.imports),
          importsKeys = keys(imports),
          importsValues = values(imports);

      var isEvaluating,
          index = 0,
          interpolate = options.interpolate || reNoMatch,
          source = "__p += '";

      // compile the regexp to match each delimiter
      var reDelimiters = RegExp(
        (options.escape || reNoMatch).source + '|' +
        interpolate.source + '|' +
        (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
        (options.evaluate || reNoMatch).source + '|$'
      , 'g');

      text.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
        interpolateValue || (interpolateValue = esTemplateValue);

        // escape characters that cannot be included in string literals
        source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);

        // replace delimiters with snippets
        if (escapeValue) {
          source += "' +\n__e(" + escapeValue + ") +\n'";
        }
        if (evaluateValue) {
          isEvaluating = true;
          source += "';\n" + evaluateValue + ";\n__p += '";
        }
        if (interpolateValue) {
          source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
        }
        index = offset + match.length;

        // the JS engine embedded in Adobe products requires returning the `match`
        // string in order to produce the correct `offset` value
        return match;
      });

      source += "';\n";

      // if `variable` is not specified, wrap a with-statement around the generated
      // code to add the data object to the top of the scope chain
      var variable = options.variable,
          hasVariable = variable;

      if (!hasVariable) {
        variable = 'obj';
        source = 'with (' + variable + ') {\n' + source + '\n}\n';
      }
      // cleanup code by stripping empty strings
      source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
        .replace(reEmptyStringMiddle, '$1')
        .replace(reEmptyStringTrailing, '$1;');

      // frame code as the function body
      source = 'function(' + variable + ') {\n' +
        (hasVariable ? '' : variable + ' || (' + variable + ' = {});\n') +
        "var __t, __p = '', __e = _.escape" +
        (isEvaluating
          ? ', __j = Array.prototype.join;\n' +
            "function print() { __p += __j.call(arguments, '') }\n"
          : ';\n'
        ) +
        source +
        'return __p\n}';

      // Use a sourceURL for easier debugging.
      // http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
      var sourceURL = '\n/*\n//# sourceURL=' + (options.sourceURL || '/lodash/template/source[' + (templateCounter++) + ']') + '\n*/';

      try {
        var result = Function(importsKeys, 'return ' + source + sourceURL).apply(undefined, importsValues);
      } catch(e) {
        e.source = source;
        throw e;
      }
      if (data) {
        return result(data);
      }
      // provide the compiled function's source by its `toString` method, in
      // supported environments, or the `source` property as a convenience for
      // inlining compiled templates during the build process
      result.source = source;
      return result;
    }

    /**
     * Executes the callback `n` times, returning an array of the results
     * of each callback execution. The callback is bound to `thisArg` and invoked
     * with one argument; (index).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} n The number of times to execute the callback.
     * @param {Function} callback The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns an array of the results of each `callback` execution.
     * @example
     *
     * var diceRolls = _.times(3, _.partial(_.random, 1, 6));
     * // => [3, 6, 4]
     *
     * _.times(3, function(n) { mage.castSpell(n); });
     * // => calls `mage.castSpell(n)` three times, passing `n` of `0`, `1`, and `2` respectively
     *
     * _.times(3, function(n) { this.cast(n); }, mage);
     * // => also calls `mage.castSpell(n)` three times
     */
    function times(n, callback, thisArg) {
      n = (n = +n) > -1 ? n : 0;
      var index = -1,
          result = Array(n);

      callback = baseCreateCallback(callback, thisArg, 1);
      while (++index < n) {
        result[index] = callback(index);
      }
      return result;
    }

    /**
     * The inverse of `_.escape` this method converts the HTML entities
     * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to their
     * corresponding characters.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to unescape.
     * @returns {string} Returns the unescaped string.
     * @example
     *
     * _.unescape('Fred, Barney &amp; Pebbles');
     * // => 'Fred, Barney & Pebbles'
     */
    function unescape(string) {
      return string == null ? '' : String(string).replace(reEscapedHtml, unescapeHtmlChar);
    }

    /**
     * Generates a unique ID. If `prefix` is provided the ID will be appended to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} [prefix] The value to prefix the ID with.
     * @returns {string} Returns the unique ID.
     * @example
     *
     * _.uniqueId('contact_');
     * // => 'contact_104'
     *
     * _.uniqueId();
     * // => '105'
     */
    function uniqueId(prefix) {
      var id = ++idCounter;
      return String(prefix == null ? '' : prefix) + id;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object that wraps the given value with explicit
     * method chaining enabled.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to wrap.
     * @returns {Object} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'pebbles', 'age': 1 }
     * ];
     *
     * var youngest = _.chain(characters)
     *     .sortBy('age')
     *     .map(function(chr) { return chr.name + ' is ' + chr.age; })
     *     .first()
     *     .value();
     * // => 'pebbles is 1'
     */
    function chain(value) {
      value = new lodashWrapper(value);
      value.__chain__ = true;
      return value;
    }

    /**
     * Invokes `interceptor` with the `value` as the first argument and then
     * returns `value`. The purpose of this method is to "tap into" a method
     * chain in order to perform operations on intermediate results within
     * the chain.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to provide to `interceptor`.
     * @param {Function} interceptor The function to invoke.
     * @returns {*} Returns `value`.
     * @example
     *
     * _([1, 2, 3, 4])
     *  .tap(function(array) { array.pop(); })
     *  .reverse()
     *  .value();
     * // => [3, 2, 1]
     */
    function tap(value, interceptor) {
      interceptor(value);
      return value;
    }

    /**
     * Enables explicit method chaining on the wrapper object.
     *
     * @name chain
     * @memberOf _
     * @category Chaining
     * @returns {*} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // without explicit chaining
     * _(characters).first();
     * // => { 'name': 'barney', 'age': 36 }
     *
     * // with explicit chaining
     * _(characters).chain()
     *   .first()
     *   .pick('age')
     *   .value();
     * // => { 'age': 36 }
     */
    function wrapperChain() {
      this.__chain__ = true;
      return this;
    }

    /**
     * Produces the `toString` result of the wrapped value.
     *
     * @name toString
     * @memberOf _
     * @category Chaining
     * @returns {string} Returns the string result.
     * @example
     *
     * _([1, 2, 3]).toString();
     * // => '1,2,3'
     */
    function wrapperToString() {
      return String(this.__wrapped__);
    }

    /**
     * Extracts the wrapped value.
     *
     * @name valueOf
     * @memberOf _
     * @alias value
     * @category Chaining
     * @returns {*} Returns the wrapped value.
     * @example
     *
     * _([1, 2, 3]).valueOf();
     * // => [1, 2, 3]
     */
    function wrapperValueOf() {
      return this.__wrapped__;
    }

    /*--------------------------------------------------------------------------*/

    // add functions that return wrapped values when chaining
    lodash.after = after;
    lodash.assign = assign;
    lodash.at = at;
    lodash.bind = bind;
    lodash.bindAll = bindAll;
    lodash.bindKey = bindKey;
    lodash.chain = chain;
    lodash.compact = compact;
    lodash.compose = compose;
    lodash.constant = constant;
    lodash.countBy = countBy;
    lodash.create = create;
    lodash.createCallback = createCallback;
    lodash.curry = curry;
    lodash.debounce = debounce;
    lodash.defaults = defaults;
    lodash.defer = defer;
    lodash.delay = delay;
    lodash.difference = difference;
    lodash.filter = filter;
    lodash.flatten = flatten;
    lodash.forEach = forEach;
    lodash.forEachRight = forEachRight;
    lodash.forIn = forIn;
    lodash.forInRight = forInRight;
    lodash.forOwn = forOwn;
    lodash.forOwnRight = forOwnRight;
    lodash.functions = functions;
    lodash.groupBy = groupBy;
    lodash.indexBy = indexBy;
    lodash.initial = initial;
    lodash.intersection = intersection;
    lodash.invert = invert;
    lodash.invoke = invoke;
    lodash.keys = keys;
    lodash.map = map;
    lodash.mapValues = mapValues;
    lodash.max = max;
    lodash.memoize = memoize;
    lodash.merge = merge;
    lodash.min = min;
    lodash.omit = omit;
    lodash.once = once;
    lodash.pairs = pairs;
    lodash.partial = partial;
    lodash.partialRight = partialRight;
    lodash.pick = pick;
    lodash.pluck = pluck;
    lodash.property = property;
    lodash.pull = pull;
    lodash.range = range;
    lodash.reject = reject;
    lodash.remove = remove;
    lodash.rest = rest;
    lodash.shuffle = shuffle;
    lodash.sortBy = sortBy;
    lodash.tap = tap;
    lodash.throttle = throttle;
    lodash.times = times;
    lodash.toArray = toArray;
    lodash.transform = transform;
    lodash.union = union;
    lodash.uniq = uniq;
    lodash.values = values;
    lodash.where = where;
    lodash.without = without;
    lodash.wrap = wrap;
    lodash.xor = xor;
    lodash.zip = zip;
    lodash.zipObject = zipObject;

    // add aliases
    lodash.collect = map;
    lodash.drop = rest;
    lodash.each = forEach;
    lodash.eachRight = forEachRight;
    lodash.extend = assign;
    lodash.methods = functions;
    lodash.object = zipObject;
    lodash.select = filter;
    lodash.tail = rest;
    lodash.unique = uniq;
    lodash.unzip = zip;

    // add functions to `lodash.prototype`
    mixin(lodash);

    /*--------------------------------------------------------------------------*/

    // add functions that return unwrapped values when chaining
    lodash.clone = clone;
    lodash.cloneDeep = cloneDeep;
    lodash.contains = contains;
    lodash.escape = escape;
    lodash.every = every;
    lodash.find = find;
    lodash.findIndex = findIndex;
    lodash.findKey = findKey;
    lodash.findLast = findLast;
    lodash.findLastIndex = findLastIndex;
    lodash.findLastKey = findLastKey;
    lodash.has = has;
    lodash.identity = identity;
    lodash.indexOf = indexOf;
    lodash.isArguments = isArguments;
    lodash.isArray = isArray;
    lodash.isBoolean = isBoolean;
    lodash.isDate = isDate;
    lodash.isElement = isElement;
    lodash.isEmpty = isEmpty;
    lodash.isEqual = isEqual;
    lodash.isFinite = isFinite;
    lodash.isFunction = isFunction;
    lodash.isNaN = isNaN;
    lodash.isNull = isNull;
    lodash.isNumber = isNumber;
    lodash.isObject = isObject;
    lodash.isPlainObject = isPlainObject;
    lodash.isRegExp = isRegExp;
    lodash.isString = isString;
    lodash.isUndefined = isUndefined;
    lodash.lastIndexOf = lastIndexOf;
    lodash.mixin = mixin;
    lodash.noConflict = noConflict;
    lodash.noop = noop;
    lodash.now = now;
    lodash.parseInt = parseInt;
    lodash.random = random;
    lodash.reduce = reduce;
    lodash.reduceRight = reduceRight;
    lodash.result = result;
    lodash.runInContext = runInContext;
    lodash.size = size;
    lodash.some = some;
    lodash.sortedIndex = sortedIndex;
    lodash.template = template;
    lodash.unescape = unescape;
    lodash.uniqueId = uniqueId;

    // add aliases
    lodash.all = every;
    lodash.any = some;
    lodash.detect = find;
    lodash.findWhere = find;
    lodash.foldl = reduce;
    lodash.foldr = reduceRight;
    lodash.include = contains;
    lodash.inject = reduce;

    mixin(function() {
      var source = {}
      forOwn(lodash, function(func, methodName) {
        if (!lodash.prototype[methodName]) {
          source[methodName] = func;
        }
      });
      return source;
    }(), false);

    /*--------------------------------------------------------------------------*/

    // add functions capable of returning wrapped and unwrapped values when chaining
    lodash.first = first;
    lodash.last = last;
    lodash.sample = sample;

    // add aliases
    lodash.take = first;
    lodash.head = first;

    forOwn(lodash, function(func, methodName) {
      var callbackable = methodName !== 'sample';
      if (!lodash.prototype[methodName]) {
        lodash.prototype[methodName]= function(n, guard) {
          var chainAll = this.__chain__,
              result = func(this.__wrapped__, n, guard);

          return !chainAll && (n == null || (guard && !(callbackable && typeof n == 'function')))
            ? result
            : new lodashWrapper(result, chainAll);
        };
      }
    });

    /*--------------------------------------------------------------------------*/

    /**
     * The semantic version number.
     *
     * @static
     * @memberOf _
     * @type string
     */
    lodash.VERSION = '2.4.1';

    // add "Chaining" functions to the wrapper
    lodash.prototype.chain = wrapperChain;
    lodash.prototype.toString = wrapperToString;
    lodash.prototype.value = wrapperValueOf;
    lodash.prototype.valueOf = wrapperValueOf;

    // add `Array` functions that return unwrapped values
    forEach(['join', 'pop', 'shift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        var chainAll = this.__chain__,
            result = func.apply(this.__wrapped__, arguments);

        return chainAll
          ? new lodashWrapper(result, chainAll)
          : result;
      };
    });

    // add `Array` functions that return the existing wrapped value
    forEach(['push', 'reverse', 'sort', 'unshift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        func.apply(this.__wrapped__, arguments);
        return this;
      };
    });

    // add `Array` functions that return new wrapped values
    forEach(['concat', 'slice', 'splice'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        return new lodashWrapper(func.apply(this.__wrapped__, arguments), this.__chain__);
      };
    });

    return lodash;
  }

  /*--------------------------------------------------------------------------*/

  // expose Lo-Dash
  var _ = runInContext();

  // some AMD build optimizers like r.js check for condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash is loaded with a RequireJS shim config.
    // See http://requirejs.org/docs/api.html#config-shim
    root._ = _;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define(function() {
      return _;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports && freeModule) {
    // in Node.js or RingoJS
    if (moduleExports) {
      (freeModule.exports = _)._ = _;
    }
    // in Narwhal or Rhino -require
    else {
      freeExports._ = _;
    }
  }
  else {
    // in a browser or Rhino
    root._ = _;
  }
}.call(this));

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\..\\node_modules\\lodash\\dist\\lodash.js","/..\\..\\..\\node_modules\\lodash\\dist")
},{"buffer":1,"htZkx4":4}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var startTime = new Date(),
    gameRoomID,
    isHost,
    controlMode,
    state = 'waiting';

function init() {
	socketsManager.init();
}

function getStartTime() {
    return startTime;
}

function onConnectionReady(mode) {
    controlMode = mode;

	stageManager.init();

    if (controlMode === 'desktopOnly') {
        desktopControlsManager.init();
        touchControlsManager.init();
    }
}

function onGameReady(newGameRoomID, newGameIsHost) {
    gameRoomID = newGameRoomID;
    isHost = newGameIsHost;
    state = 'ready';

    racketsManager.setPlayerSide(isHost);
    racketsManager.resetRacketsPositions();

    if (isHost) {
        ballsManager.createBalls(64, null, 650, 2000, 4);
    }
}

function onOpponentDisconnect() {
    state = 'waiting';
    ballsManager.removeAllBalls();
}

function getState() {
    return state;
}

function getIsHost() {
    return isHost;
}

function getMode() {
    return controlMode;
}

module.exports =  {
	init: init,
    getStartTime: getStartTime,
    onConnectionReady: onConnectionReady,
    onGameReady: onGameReady,
    onOpponentDisconnect: onOpponentDisconnect,
    getState: getState,
    getIsHost: getIsHost,
    getMode: getMode
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/appManager.js","/")
},{"buffer":1,"htZkx4":4}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var Ball = require('./class/Ball');


var balls = [];

function init(scene) {
	
}

function createBall(ballData) {
    ballData.ID = ballData.ID || getID();
    if (!balls[ballData.ID]) {
    	var newBall = new Ball(ballData.ID, ballData.pos, ballData.color, ballData.radius);
        // console.log('created ball #' + newBall.ID, newBall, balls[ballData.ID])
        physicsEngine.setVel(newBall, ballData.vel);
        syncManager.onCreateBall(newBall);
        stageManager.getScene().addBall(newBall);
        balls[ballData.ID] = newBall;
		setTimeout(function() {
    		newBall.enablePhysics();
		}, 50);
    }
}

function createBalls(number, pos, vel, interval, turns, angle, remaining) {
	pos   = pos   || stageManager.getScene().getCenter();
    vel   = vel   || 1000;
    turns = turns || 1;
    angle = angle === undefined ? Math.PI/number : angle;
	remaining = remaining === undefined ? number : remaining;
    createBall({
        pos: pos, 
        vel: new Vector2(vel * Math.cos(angle + (Math.random() - 0.5) * Math.PI * 0.08) , vel * Math.sin(angle + (Math.random() - 0.5) * Math.PI * 0.08) )
    });
	if (remaining > 1 && appManager.getState() === 'ready') {
    	setTimeout(function() {
    		createBalls(number, pos, vel, interval, turns, angle + 2 * turns * Math.PI / number, remaining - 1);
    	}, interval);
    }
}

function updateBall(ballData) {
    if (ballData && ballData.ID && balls[ballData.ID]) {
        if (ballData.pos) {
            balls[ballData.ID].x = ballData.pos.x;
            balls[ballData.ID].y = ballData.pos.y;
        }
        if (ballData.vel) {
            balls[ballData.ID].vel.copy(ballData.vel);
        }
    }
    else {
        console.log('error : ball #', ballData.ID, balls[ballData.ID]);
    }
}

function removeAllBalls() {
    balls.forEach(removeBall);
    stageManager.getScene().clearBalls();
    balls = [];
}

function removeBall(ball) {
    if (ball) {
        stageManager.getScene().removeBall(ball);
        delete balls[ball.ID];
    }
}

function onBallOut(ball) {
    if (appManager.getIsHost()) {
        syncManager.onBallOut(ball);
        setBallOut(ball);
    }
}

function onBallOutDestroy(ball) {
    if (appManager.getIsHost()) {
        syncManager.onBallDestroy(ball);
        destroyBall(ball);
    }
}

function setBallOut(ball) {
    ball.out = true;
    setTimeout(function() {
        destroyBall(ball);
    }, 750);
}

function destroyBall(ball) {
    particlesManager.createBallExplodeParticles(ball);
    removeBall(ball);
}

function getID() {
    var ID = Math.round(Math.random() * 10000);
    return balls[ID] ? getID() : ID;
}

function getBalls() {
	return balls;
}

function getBall(ID) {
    return balls[ID] || null;
}

module.exports =  {
	init: init,
	createBall: createBall,
	createBalls: createBalls,
    updateBall: updateBall,
    removeAllBalls: removeAllBalls,
    removeBall: removeBall,
    getID: getID,
	getBalls: getBalls,
    getBall: getBall,
    onBallOut: onBallOut,
    onBallOutDestroy: onBallOutDestroy,
    setBallOut: setBallOut,
    destroyBall: destroyBall
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/ballsManager.js","/")
},{"./class/Ball":8,"buffer":1,"htZkx4":4}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
Ball = function(ID, pos, color, size) {
    PIXI.DisplayObjectContainer.call( this );
    this.ID = ID;
    this.size = size || 28;
    this.color  = color  || parseInt(Please.make_color().slice(1), 16);
    this.colorHex = '#' + this.color.toString(16);
    this.vel = new Vector2(0, 0);
    this.out = false;

    this.physics = false;

	var graphics = new PIXI.Graphics();
	graphics.beginFill(this.color);
	graphics.drawRect(0, 0, this.size, this.size);
    this.addChild(graphics);

    this.x = pos ? pos.x : 0;
    this.y = pos ? pos.y : 0;
    
};

Ball.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Ball.prototype.constructor = Ball;

Ball.prototype.enablePhysics = function() {
    this.physics = true;
};

Ball.prototype.disablePhysics = function() {
	this.physics = false;
};


module.exports = Ball;
}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/class\\Ball.js","/class")
},{"buffer":1,"htZkx4":4}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
Hud = function() {
    PIXI.DisplayObjectContainer.call( this );
    this.infos = new PIXI.Text('', {font: 'bold 40px Arial'});
    this.infos.x = 10;
    this.infos.y = 10;
    this.addChild(this.infos);

    this.debug1 = new PIXI.Text('');
    this.debug1.x = 100;
    this.debug1.y = 400;
    this.addChild(this.debug1);

    this.debug2 = new PIXI.Text('');
    this.debug2.x = 400;
    this.debug2.y = 400;
    this.addChild(this.debug2);

};

Hud.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Hud.prototype.constructor = Hud;

Hud.prototype.setInfosText = function(text) {
    this.infos.setText(text);
    this.infos.setStyle({
        font: 'bold 40px Arial',
        fill: Please.make_color()});
};

Hud.prototype.setDebug1Text = function(text) {
    this.debug1.setText(text);
    this.debug1.setStyle({fill: Please.make_color()});
};

Hud.prototype.setDebug2Text = function(text) {
    this.debug2.setText(text);
    this.debug2.setStyle({fill: Please.make_color()});
};


module.exports = Hud;
}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/class\\Hud.js","/class")
},{"buffer":1,"htZkx4":4}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
Racket = function(pos, color) {
    PIXI.DisplayObjectContainer.call( this );
    pos = pos || new Vector2();
    this.color = color || 0xFFFFFF;
    this.size = 240;

    this.graphics = new PIXI.Graphics();
    this.graphics.beginFill(this.color);
    this.graphics.drawRect(0, 0, 40, this.size);
    this.addChild(this.graphics);

    this.vel = new Vector2();

    this.updatePivot();
    this.x = pos.x;
    this.y = pos.y;

    this.movingToY = 0;
};

Racket.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Racket.prototype.constructor = Racket;

Racket.prototype.setMovingToY = function(y) {
	this.movingToY = y - this.height * 0.5 < 0 ? this.height * 0.5 :
                     y + this.height * 0.5 > gameConfig.baseSceneHeight ? gameConfig.baseSceneHeight - this.height * 0.5 :
                     y;

};

Racket.prototype.updatePivot = function() {
    this.pivot.x = this.width * 0.5;
    this.pivot.y = this.height * 0.5;
};


module.exports = Racket;
}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/class\\Racket.js","/class")
},{"buffer":1,"htZkx4":4}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
Scene = function(baseWidth, baseHeight) {
    PIXI.DisplayObjectContainer.call( this );
    this.baseWidth = baseWidth;
    this.baseHeight = baseHeight;
    this.width = baseWidth;
    this.height = baseHeight;
    this.init();
};

Scene.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Scene.prototype.constructor = Scene;

Scene.prototype.init = function() {
	this.drawBounds();

	this.particlesContainer = new PIXI.DisplayObjectContainer();        
	this.racketsContainer   = new PIXI.DisplayObjectContainer();        
	this.ballsContainer     = new PIXI.DisplayObjectContainer(); 

    this.addChild(this.particlesContainer);
    this.addChild(this.racketsContainer);
    this.addChild(this.ballsContainer);
};

Scene.prototype.drawBounds = function() {
	var graphics = new PIXI.Graphics();
 	 
	graphics.beginFill(0x222222);
	// graphics.lineStyle(5, 0xFFFFFF);
	graphics.drawRect(0, 0, this.baseWidth, this.baseHeight);

	this.addChild(graphics);
};

Scene.prototype.getCenter = function() {
	return new Vector2(this.baseWidth / 2, this.baseHeight / 2);
};

// Scene.prototype.clearObjectsOfType = function(type) {
// 	var objects = _.filter(this.children, function(object) { 
// 		return object instanceof type;
// 	});

// 	objects.forEach(function(object) {
// 		this.removeChild(object);
// 	}.bind(this));
// };

Scene.prototype.clearBalls = function() {
	this.ballsContainer.removeChildren();
};

Scene.prototype.addBall = function(ball) {
	this.ballsContainer.addChild(ball);
};

Scene.prototype.removeBall = function(ball) {
	this.ballsContainer.removeChild(ball);
};

Scene.prototype.addRacket = function(racket) {
	this.racketsContainer.addChild(racket);
};

Scene.prototype.getParticlesContainer = function() {
	return this.particlesContainer;
};

Scene.prototype.getRacketsContainer = function() {
	return this.racketsContainer;
};

Scene.prototype.getBallsContainer = function() {
	return this.ballsContainer;
};

module.exports = Scene;
}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/class\\Scene.js","/class")
},{"buffer":1,"htZkx4":4}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/**
 * @author mr.doob / http://mrdoob.com/
 * @author philogb / http://blog.thejit.org/
 * @author egraether / http://egraether.com/
 * @author zz85 / http://www.lab4games.net/zz85/blog
 */

Vector2 = function ( x, y ) {

	this.x = x || 0;
	this.y = y || 0;

};

Vector2.prototype = {

	constructor: Vector2,

	set: function ( x, y ) {

		this.x = x;
		this.y = y;

		return this;

	},

	copy: function ( v ) {

		this.x = v.x;
		this.y = v.y;

		return this;

	},

	clone: function () {

		return new Vector2( this.x, this.y );

	},


	add: function ( v1, v2 ) {

		this.x = v1.x + v2.x;
		this.y = v1.y + v2.y;

		return this;

	},

	addSelf: function ( v ) {

		this.x += v.x;
		this.y += v.y;

		return this;

	},

	sub: function ( v1, v2 ) {

		this.x = v1.x - v2.x;
		this.y = v1.y - v2.y;

		return this;

	},

	subSelf: function ( v ) {

		this.x -= v.x;
		this.y -= v.y;

		return this;

	},

	multiplyScalar: function ( s ) {

		this.x *= s;
		this.y *= s;

		return this;

	},

	divideScalar: function ( s ) {

		if ( s ) {

			this.x /= s;
			this.y /= s;

		} else {

			this.set( 0, 0 );

		}

		return this;

	},


	negate: function() {

		return this.multiplyScalar( -1 );

	},

	dot: function ( v ) {

		return this.x * v.x + this.y * v.y;

	},

	lengthSq: function () {

		return this.x * this.x + this.y * this.y;

	},

	length: function () {

		return Math.sqrt( this.lengthSq() );

	},

	normalize: function () {

		return this.divideScalar( this.length() );

	},

	distanceTo: function ( v ) {

		return Math.sqrt( this.distanceToSquared( v ) );

	},

	distanceToSquared: function ( v ) {

		var dx = this.x - v.x, dy = this.y - v.y;
		return dx * dx + dy * dy;

	},


	setLength: function ( l ) {

		return this.normalize().multiplyScalar( l );

	},

	equals: function( v ) {

		return ( ( v.x === this.x ) && ( v.y === this.y ) );

	}

};

module.exports = Vector2;
}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/class\\Vector2.js","/class")
},{"buffer":1,"htZkx4":4}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var startTime,
    gestures,
    mouseY = 0,
    lastMouseY = 0,
    mouseStopTime = -1,
    lastSentY = 0;


function init() {

    $( document ).on( 'mousemove', onMouseMove );

}

function update( delta ) {

    // automatically send sync of exact position after mouse stop 0.1s 
    if ( mouseStopTime > 0.1 ) {

        sendSyncPosition( lastMouseY, true );
        mouseStopTime = -1;

    } else if ( lastMouseY === mouseY && mouseStopTime >= 0 ) {

        mouseStopTime += delta;

    } else if ( lastMouseY !== mouseY ) {

        // sync mouse position if moved by more than 24px (local)
        if ( Math.abs( lastSentY - stageManager.globalToSceneLocalY( mouseY ) ) > 24 ) {

            sendSyncPosition( mouseY, false );

        }
    }

    lastMouseY = mouseY;

}

function sendSyncPosition( y, instant ) {

    lastSentY = racketsManager.getPlayerRacketMovingToY();
    syncManager.onRacketSetMovingToY( lastSentY, instant );

}

function onMouseMove( event ) {

    mouseY = event.pageY || event.originalEvent.touches && event.originalEvent.touches[ 0 ].pageY;
    
    if (mouseY !== undefined) {

        racketsManager.movePlayerRacketTo( stageManager.globalToSceneLocalY( mouseY ), false );
        mouseStopTime = 0;
        
    }
}

module.exports = {
    init: init,
    update: update
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/desktopControlsManager.js","/")
},{"buffer":1,"htZkx4":4}],14:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
global.gameConfig = {
    width: window.innerWidth,
    height: window.innerHeight,
    baseSceneWidth: 1440,
    baseSceneHeight: 900,
    checkDeltaIntervalTime: 500
};

global.appManager             = require('./appManager');
global.ballsManager           = require('./ballsManager');
global.desktopControlsManager = require('./desktopControlsManager');
global.touchControlsManager   = require('./touchControlsManager');
global.hudManager             = require('./hudManager');
global.particlesManager       = require('./particlesManager');
global.physicsEngine          = require('./physicsEngine');
global.racketsManager         = require('./racketsManager');
global.socketsManager         = require('./socketsManager');
global.stageManager           = require('./stageManager');
global.syncManager            = require('./syncManager');


if ( window.location.protocol === "file:" ) { // cordova

	document.addEventListener("deviceready", onDeviceReady, false);

} else {

	appManager.init();

}

function onDeviceReady() {
	appManager.init();
}

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_ef76daba.js","/")
},{"./appManager":6,"./ballsManager":7,"./desktopControlsManager":13,"./hudManager":15,"./particlesManager":16,"./physicsEngine":17,"./racketsManager":18,"./socketsManager":19,"./stageManager":20,"./syncManager":21,"./touchControlsManager":22,"buffer":1,"htZkx4":4}],15:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var Hud = require('./class/Hud');

var hud;

function init() {
	hud = new Hud();
    stageManager.getStage().addChild(hud);

    setDebug1Text('YOU:');
    setDebug2Text('HIM:');
}

function initStage() {
	console.log('initStage');
	stageManager.init();
}

function setInfosText(text) {
    hud.setInfosText(text);
}

function setDebug1Text(text) {
    hud.setDebug1Text(text);
}

function setDebug2Text(text) {
    hud.setDebug2Text(text);
}

module.exports = {
	init: init,
    setInfosText: setInfosText,
    setDebug1Text: setDebug1Text,
    setDebug2Text: setDebug2Text
};



}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/hudManager.js","/")
},{"./class/Hud":9,"buffer":1,"htZkx4":4}],16:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var _ = require('lodash');

var particlesContainer,
    emitters = [],
    poolSize = 18,
    pool = [];


function init() {
    particlesContainer = stageManager.getScene().getParticlesContainer();
    initPool();
}

function update(delta) {
    pool.forEach(function(emitter, index) {
        if (emitter.emit || emitter._activeParticles.length)
        emitter.update(delta);
    });
}

function initPool() {
    for (var i = 0; i < poolSize; i++) {
        pool[i] = new cloudkid.Emitter(particlesContainer);
    }
}

function initUnusedEmitter(config) {
    var emitter = findUnusedEmitter();
    if (emitter) {
        emitter.init([PIXI.Texture.fromImage('textures/pixel24.png')], config);
        emitter.emit = true;
    }
}

function findUnusedEmitter() {
    return _.find(pool, function(emitter) {
        return !emitter.emit && emitter._activeParticles.length === 0;
    });
}

function createBallCollideParticles(ball, angle) {
    if (ball) { 
        initUnusedEmitter({
            "alpha": {
                "start": 0.8,
                "end": 0
            },
            "scale": {
                "start": 1 / 24 * ball.size,
                "end":   1 / 54 * ball.size,
                "minimumScaleMultiplier": 1
            },
            "color": {
                "start": ball.colorHex,
                "end": "#333333"
            },
            "speed": {
                "start": 10 * ball.size,
                "end": 2 * ball.size
            },
            "acceleration": {
                "x": 0,
                "y": 0
            },
            "startRotation": {
                "min": angle - 60,
                "max": angle + 60
            },
            "rotationSpeed": {
                "min": 0,
                "max": 0
            },
            "lifetime": {
                "min": 0.2,
                "max": 0.5
            },
            "blendMode": "normal",
            "frequency": 0.02,
            "emitterLifetime": 0.2,
            "maxParticles": 6,
            "pos": {
                "x": ball.x + ball.size / 2,
                "y": ball.y + ball.size / 2
            },
            "addAtBack": false,
            "spawnType": "point"
        });
    }
}

function createBallExplodeParticles(ball) {
    if (ball) {
        initUnusedEmitter({
            "alpha": {
                "start": 0.8,
                "end": 0
            },
            "scale": {
                "start": 1 / 24 * ball.size,
                "end":   1 / 48 * ball.size,
                "minimumScaleMultiplier": 1
            },
            "color": {
                "start": ball.colorHex,
                "end": "#333333"
            },
            "speed": {
                "start": 50 * ball.size,
                "end": 10 * ball.size
            },
            "acceleration": {
                "x": 0,
                "y": 0
            },
            "startRotation": {
                "min": 0,
                "max": 360
            },
            "rotationSpeed": {
                "min": 0,
                "max": 0
            },
            "lifetime": {
                "min": 0.1,
                "max": 0.5
            },
            "blendMode": "normal",
            "frequency": 0.01,
            "emitterLifetime": 0.15,
            "maxParticles": 32,
            "pos": {
                "x": ball.x + ball.size / 2,
                "y": ball.y + ball.size / 2
            },
            "addAtBack": false,
            "spawnType": "point"
        });
    }
}

function getEmitters() {
    return emitters;
}



module.exports = {
    init: init,
    update: update,
    createBallCollideParticles: createBallCollideParticles,
    createBallExplodeParticles: createBallExplodeParticles,
    getEmitters: getEmitters
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/particlesManager.js","/")
},{"buffer":1,"htZkx4":4,"lodash":5}],17:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
Vector2 = require( './class/Vector2' );


var currentDelta = 0,
    currentDec = new Vector2(),
    currentRatio = 1,
    safetyGapSize = 6,
    racketsMargin = 34;


function init() {


}

function update( delta ) {

    currentDelta = delta;

    if ( currentDelta ) {

        updateRackets();
        updateBalls();

    }
}

function setVel( object, vel ) {

    object.vel.copy( vel );

}

function addVel( object, vel ) {

    object.vel.addSelf( vel );

}

function updateRackets() {

    updateRacket( racketsManager.getLeftRacket() );
    updateRacket( racketsManager.getRightRacket() );

}

function updateRacket( racket ) {

    if ( Math.abs( racket.y - racket.movingToY ) > 1 ) {

        racket.y += ( racket.movingToY - racket.y ) * 8 * currentDelta;

    } else {

        racket.y = racket.movingToY;

    }
}

function updateBalls() {

    ballsManager.getBalls().forEach( updateBall );

}

function updateBall( ball, index ) {

    if ( ball && ball.physics ) {

        if ( ball.vel.x >= -50 && ball.vel.x <= 50 ) {

            ball.vel.x = ball.vel.x + ball.vel.x * 0.1;

        }
        checkBallCollision( ball );
        updateObjectPos( ball );
        applyMagnetForce( ball );

    }
}

function updateObjectPos( object ) {

    object.x = object.x + object.vel.x * currentDelta;
    object.y = object.y + object.vel.y * currentDelta;

}

function checkBallCollision( ball ) {
    ball.nextX = ball.x + ball.vel.x * currentDelta;
    ball.nextY = ball.y + ball.vel.y * currentDelta;

    // Test top collision
    if ( ball.nextY <= 0 ) {

        ball.y = 0;

        if ( ball.out ) {

            ballsManager.onBallOutDestroy( ball );

        } else {

            onBallCollideTop( ball );

        }
    }

    // Test bottom collision
    else if ( ball.nextY + ball.size >= gameConfig.baseSceneHeight ) {

        ball.y = gameConfig.baseSceneHeight - ball.size;

        if ( ball.out ) {

            ballsManager.onBallOutDestroy( ball );

        } else {

            onBallCollideBottom( ball );

        }
    }

    // If ball is not out of the game
    if ( !ball.out ) {

        // Test left collision
        if ( ball.nextX <= racketsManager.getLeftRacketBoundsRightX() &&
            ball.x >= racketsManager.getLeftRacketBoundsRightX() ) {

            // If the ball touches left racket
            if ( ball.nextY + ball.size > racketsManager.getLeftRacketBoundsTopY() &&
                ball.nextY < racketsManager.getLeftRacketBoundsBottomY() ) {

                ball.x = racketsManager.getLeftRacketBoundsRightX();
                onBallCollideLeft( ball );

            } else if ( ball.nextX < racketsManager.getLeftRacketBoundsRightX() ) {

                ballsManager.onBallOut( ball );

            }
        }
        // Test right collision
        else if ( ball.nextX + ball.size >= racketsManager.getRightRacketBoundsLeftX() &&
            ball.x + ball.size <= racketsManager.getRightRacketBoundsLeftX() ) {

            // If the ball touches right racket
            if ( ball.nextY + ball.size > racketsManager.getRightRacketBoundsTopY() &&
                ball.nextY < racketsManager.getRightRacketBoundsBottomY() ) {

                ball.x = racketsManager.getRightRacketBoundsLeftX() - ball.size;
                onBallCollideRight( ball );

            } else if ( ball.nextX + ball.size > racketsManager.getRightRacketBoundsLeftX() ) {

                ballsManager.onBallOut( ball );

            }
        }
    }

    // If ball is out, test collision with top & bottom of rackets
    if ( ball.out ) {

        // Ball needs to be destroy
        if ( ball.nextX + ball.width < racketsManager.getLeftRacketBoundsLeftX() - 40 * currentRatio ||
            ball.nextX > racketsManager.getRightRacketBoundsRightX() + 40 * currentRatio ) {

            ballsManager.onBallOutDestroy( ball );

        }

        // Left racket
        else if ( ball.nextX < racketsManager.getLeftRacketBoundsRightX() &&
            ball.nextY + ball.height > racketsManager.getLeftRacketBoundsTopY() &&
            ball.nextY < racketsManager.getLeftRacketBoundsBottomY() ) {

            var leftRacketCenterY = ( racketsManager.getLeftRacketBoundsTopY() + racketsManager.getLeftRacketBoundsBottomY() ) * 0.5;

            // collide top of racket
            if ( ball.vel.y > 0 ) {

                onBallCollideTop( ball );

                ball.y = racketsManager.getLeftRacketBoundsTopY() - ball.height - 2 * safetyGapSize;

            }
            // collide bottom of racket
            else if ( ball.vel.y < 0 ) {

                onBallCollideBottom( ball );

                ball.y = racketsManager.getLeftRacketBoundsBottomY() + 2 * safetyGapSize;

            }
        }

        // Right racket
        else if ( ball.nextX + ball.width > racketsManager.getRightRacketBoundsLeftX() &&
            ball.nextY + ball.height > racketsManager.getRightRacketBoundsTopY() &&
            ball.nextY < racketsManager.getRightRacketBoundsBottomY() ) {

            var rightRacketCenterY = ( racketsManager.getLeftRacketBoundsTopY() + racketsManager.getLeftRacketBoundsBottomY() ) * 0.5;

            // collide top of racket
            if ( ball.vel.y > 0 ) {

                if ( ball.y < racketsManager.getRightRacket().y ) {

                    onBallCollideTop( ball );

                }

                ball.y = ( racketsManager.getRightRacketBoundsTopY() - ball.height ) - 2 * safetyGapSize;

            }
            // collide bottom of racket
            else if ( ball.vel.y < 0 ) {

                if ( ball.y > racketsManager.getRightRacket().y ) {

                    onBallCollideBottom( ball );

                }

                ball.y = racketsManager.getRightRacketBoundsBottomY() + 2 * safetyGapSize;

            }
        }
    }
}

function onBallCollideTop( ball ) {

    ball.vel.y = -ball.vel.y;
    ball.vel.x += ball.vel.x * 0.02;
    if ( !ball.out ) {

        syncManager.onUpdateBall( ball, 't' );

    }
    particlesManager.createBallCollideParticles( ball, 90 );

}

function onBallCollideBottom( ball ) {

    ball.vel.y = -ball.vel.y;
    ball.vel.x += ball.vel.x * 0.02;
    if ( !ball.out ) {

        syncManager.onUpdateBall( ball, 'b' );

    }
    particlesManager.createBallCollideParticles( ball, 270 );

}

function onBallCollideLeft( ball ) {

    ball.vel.x = -ball.vel.x;
    syncManager.onUpdateBall( ball, 'l' );
    particlesManager.createBallCollideParticles( ball, 0 );

}

function onBallCollideRight( ball ) {

    ball.vel.x = -ball.vel.x;
    syncManager.onUpdateBall( ball, 'r' );
    particlesManager.createBallCollideParticles( ball, 180 );

}

function applyMagnetForce( ball ) {

    if ( ball.vel.x < 0 ) {
        // ball.vel.y = (ball.vel.y - (racketsManager.getLeftRacket().getCenter().y - ball.y) * 0.1);
        // ball.vel.y = ball.vel.y + (1/(ball.y - racketsManager.getLeftRacket().getCenter().y)) * 10
        // console.log(ball.y - racketsManager.getLeftRacket().getCenter().y);
    }

}

function updateSceneResizeValues( dec, ratio ) {

    currentDec = dec;
    currentRatio = ratio;

}

module.exports = {
    init: init,
    update: update,
    setVel: setVel,
    addVel: addVel,
    updateSceneResizeValues: updateSceneResizeValues
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/physicsEngine.js","/")
},{"./class/Vector2":12,"buffer":1,"htZkx4":4}],18:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var Racket = require('./class/Racket');


var playerSide = 'left',
    opponentSide = 'right',
    rackets = {
        left: null,
        right: null
    },
    margin = 30;

function init(scene) {

    rackets.left = new Racket();

    rackets.right = new Racket();

    resetRacketsPositions();

    stageManager.getScene().addRacket(rackets.left);
    stageManager.getScene().addRacket(rackets.right);
}

function resetRacketsPositions() {

    var centerY = stageManager.getScene().getCenter().y;

    rackets.left.x = margin;
    rackets.left.y = centerY;
    rackets.right.x = gameConfig.baseSceneWidth - margin;
    rackets.right.y = centerY;

    movePlayerRacketTo(centerY);
    moveOpponentRacketTo(centerY);

}

function setPlayerSide(isHost) {

    playerSide = isHost ? 'left' : 'right';
    opponentSide = isHost ? 'right' : 'left';

}

function movePlayerRacketTo(y, instant) {

    rackets[playerSide].setMovingToY(y);

    if (instant) {

        rackets[playerSide].y = (rackets[playerSide].y + y) * 0.5;

    }
}

function moveOpponentRacketTo(y, instant) {

    rackets[opponentSide].setMovingToY(y);

    if (instant) {

        rackets[opponentSide].y = (rackets[opponentSide].y + y) * 0.5;

    }
}

function movePlayerRacketBy(y) {

    movePlayerRacketTo(rackets[playerSide].y + y);

}

function getPlayerRacketY() {

    return rackets[playerSide].y;

}

function getOpponentRacketY() {

    return rackets[opponentSide].y;

}

function getPlayerRacketMovingToY() {

    return rackets[playerSide].movingToY;

}

function getLeftRacket() {

    return rackets.left;

}

function getRightRacket() {

    return rackets.right;

}

function getLeftRacketBoundsTopY() {

    return rackets.left.y - rackets.left.height / 2;

}

function getLeftRacketBoundsBottomY() {

    return rackets.left.y + rackets.left.height / 2;

}

function getLeftRacketBoundsLeftX() {

    return rackets.left.x - rackets.left.width / 2;

}

function getLeftRacketBoundsRightX() {

    return rackets.left.x + rackets.left.width / 2;

}

function getRightRacketBoundsTopY() {

    return rackets.right.y - rackets.right.height / 2;

}

function getRightRacketBoundsBottomY() {

    return rackets.right.y + rackets.right.height / 2;

}

function getRightRacketBoundsLeftX() {

    return rackets.right.x - rackets.right.width / 2;

}

function getRightRacketBoundsRightX() {

    return rackets.right.x + rackets.right.width / 2;

}

module.exports = {
    init: init,
    resetRacketsPositions: resetRacketsPositions,
    setPlayerSide: setPlayerSide,
    movePlayerRacketTo: movePlayerRacketTo,
    moveOpponentRacketTo: moveOpponentRacketTo,
    movePlayerRacketBy: movePlayerRacketBy,
    getPlayerRacketY: getPlayerRacketY,
    getOpponentRacketY: getOpponentRacketY,
    getPlayerRacketMovingToY: getPlayerRacketMovingToY,
    getLeftRacket: getLeftRacket,
    getRightRacket: getRightRacket,
    getLeftRacketBoundsTopY: getLeftRacketBoundsTopY,
    getLeftRacketBoundsLeftX: getLeftRacketBoundsLeftX,
    getLeftRacketBoundsBottomY: getLeftRacketBoundsBottomY,
    getLeftRacketBoundsRightX: getLeftRacketBoundsRightX,
    getRightRacketBoundsTopY: getRightRacketBoundsTopY,
    getRightRacketBoundsLeftX: getRightRacketBoundsLeftX,
    getRightRacketBoundsBottomY: getRightRacketBoundsBottomY,
    getRightRacketBoundsRightX: getRightRacketBoundsRightX
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/racketsManager.js","/")
},{"./class/Racket":10,"buffer":1,"htZkx4":4}],19:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var socket,
    connectionID,
    serverConfig,
    controlMode;

function init() {

	$.getJSON("config.json", function(data) {
        serverConfig = data;
        var address = serverConfig.url + ":" + serverConfig.port;

        console.log(address);
        $.getScript('http://' + address + '/socket.io/socket.io.js')
            .done(function( ) {
                initSocket('http://' + address);
            });
    });

}

function initSocket(address) {

    socket = io.connect(address);
    console.log('init socket', socket);

    sendHostRequest();
    bindSocketEvents();
}

function sendHostRequest() {
    socket.emit('newHosting');
}

function bindSocketEvents() {
    socket.on('newConnectionID', onNewConnectionID);
    socket.on('connectionReady', onConnectionReady);
}

function onNewConnectionID(data) {
    socket.removeListener('newConnectionID');

    connectionID = data.connectionID;
    
    //display text + qrcode
    var $container = $('#info-connection').show(),
        $url = $('.mobile-url', $container),
        $qrcode = $('#qr-scan', $container);

    var urlMobile   = serverConfig.url + ':' + serverConfig.port + '/mobile?id=' + data.connectionID;

    $url.text(urlMobile);
    $qrcode.qrcode({width:'200', height:'200', text:urlMobile});

    $('#desktop-only').on('click', onClickDesktopOnly);
}

function onClickDesktopOnly() {
    socket.emit('desktopOnly', connectionID);
}

function onConnectionReady(mode) {
    $('#info-connection').hide();
    socket.removeListener('connnectionReady');

    initApp();

    appManager.onConnectionReady(mode);
}

function initApp () {

    var $containerInfo = $('#container-info').show();
    var $gameState = $('#game-state');
    var $playerControlData = $('#player-control-data');
    var $opponentControlData = $('#opponent-control-data');

    var isHost;
    var gameRoomID;

    socket.on('mobile top', function() {
        var destY = racketsManager.getPlayerRacketY() - 340;
        racketsManager.movePlayerRacketTo( destY, false );
        syncManager.onRacketSetMovingToY( destY );
        // hudManager.setDebug1Text('YOU: top');
    });

    socket.on('mobile bottom', function() {
        var destY = racketsManager.getPlayerRacketY() + 340;
        racketsManager.movePlayerRacketTo( destY, false );
        syncManager.onRacketSetMovingToY( destY );
        // hudManager.setDebug1Text('YOU: bottom');
    });

    socket.on('mobile stop', function() {
        // hudManager.setDebug1Text('YOU: ');
    });

    socket.on('opponent top', function() {
        racketsManager.moveOpponentRacketTo( racketsManager.getOpponentRacketY() - 340, false );

        // hudManager.setDebug2Text('HIM: top');
    });

    socket.on('opponent bottom', function() {
        racketsManager.moveOpponentRacketTo( racketsManager.getOpponentRacketY() + 340, false );

        // hudManager.setDebug2Text('HIM: bottom');
    });

    socket.on('opponent stop', function() {
        // hudManager.setDebug2Text('HIM: ');
    });

    socket.on('opponent disconnect', function() {
        console.log('disconnected');
        hudManager.setInfosText('Opponent disconnected...');
        appManager.onOpponentDisconnect();
    });

    socket.on('game joined', function(data) {
        isHost = data.isHost;
        gameRoomID = data.gameRoomID;
        hudManager.setInfosText('Game #' + gameRoomID + ' joined. \nWaiting for another player...');
    });

    socket.on('game ready', function() {
        if (isHost) {
            hudManager.setInfosText('Game #' + gameRoomID + ' [HOST]');
        }
        else {
            hudManager.setInfosText('Game #' + gameRoomID);
        }
        appManager.onGameReady(gameRoomID, isHost);
    });

    socket.on('sync', function(data) {
        syncManager.onSync(data);
    });
}

function emit(message, data) {
    socket.emit(message, data);
}

module.exports = {
	init: init,
    emit: emit
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/socketsManager.js","/")
},{"buffer":1,"htZkx4":4}],20:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var Scene = require( './class/Scene' );

var renderer,
    stage,
    scene,
    particlesContainer,
    stats,
    lastTime = 0,
    delta = 0,
    dec = new Vector2(),
    ratio = 1,
    pixelateFilter,
    background,
    colorStepFilter,
    scanFilter,
    rgbSplitFilter,
    checkDeltaInterval,
    startTime,
    emitter,
    inactive = false,
    isPaused = false;

function init() {

    // create an new instance of a pixi stage
    stage = new PIXI.Stage( 0x222222 );

    // create a renderer instance and append the view 
    renderer = PIXI.autoDetectRenderer( window.innerWidth, window.innerHeight, null, false, true );
    document.getElementById( 'game' ).appendChild( renderer.view );


    var uniforms = {};
    uniforms.power = {
        type: '1f',
        value: 1 / 1000
    };
    uniforms.noise = {
        type: '1f',
        value: 0.2
    };

    //// grain filter..

    var fragmentSrc = [

        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying vec4 vColor;',
        'uniform sampler2D uSampler;',
        'uniform float noise;',
        'uniform float power;',

        'float rand(vec2 co) {',
        '    return fract(sin(dot(co.xy ,vec2(12.9898,78.233 * noise))) * 43758.5453);',
        '}',

        'void main(void) {',
        '   vec2 cord = vTextureCoord;',
        '   cord.y += noise * 0.001;',

        '    vec4 color = texture2D(uSampler, vTextureCoord);',

        '    float diff = (rand(vTextureCoord) - 0.5) * 0.075;',
        '    color.r += diff;',
        '    color.g += diff;',
        '    color.b += diff;',

        '   gl_FragColor = color;',
        '}'
    ];

    scanFilter = new PIXI.AbstractFilter( fragmentSrc, uniforms );

    rgbSplitFilter = new PIXI.RGBSplitFilter();
    setRGBSplitFilterSize( 3 );


    pixelateFilter = new PIXI.PixelateFilter();
    pixelateFilter.size.x = 3;
    pixelateFilter.size.y = 3;

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.right = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild( stats.domElement );

    background = new PIXI.Graphics();
    background.beginFill( 0x111111 );
    background.drawRect( 0, 0, window.innerWidth, window.innerHeight );
    stage.addChild( background );

    scene = new Scene( gameConfig.baseSceneWidth, gameConfig.baseSceneHeight );

    stage.addChild( scene );
    updateGameSize();

    window.onresize = updateGameSize;

    stage.filters = [ pixelateFilter, rgbSplitFilter ];
    // stage.filters = [pixelateFilter];

    hudManager.init();
    racketsManager.init();
    physicsEngine.init();
    particlesManager.init();



    startTime = appManager.getStartTime();
    checkDeltaInterval = setInterval( checkDelta, gameConfig.checkDeltaIntervalTime );
    update();

}

function update( time ) {

    requestAnimFrame( update );

    if ( time ) {

        delta = ( time - lastTime ) * 0.001;
        lastTime = time;

        // scanFilter.uniforms.power.value += (ease -  scanFilter.uniforms.power.value ) * 0.3;

        // scanFilter.uniforms.noise.value += 0.1;
        // scanFilter.uniforms.noise.value %= 1;
        // scanFilter.syncUniforms();

        setRGBSplitFilterSize( time );
        desktopControlsManager.update( delta );
        touchControlsManager.update( delta );
        physicsEngine.update( delta );
        particlesManager.update( delta );

        stats.update();

        renderer.render( stage );

    }

}

// Manually update physics if requestAnimFrame not available (if tab inactive)
function checkDelta() {

    var tempTime = new Date() - startTime;
    // console.log('tempTime', tempTime);
    // console.log('lastTime', lastTime);

    if ( tempTime - lastTime >= gameConfig.checkDeltaIntervalTime ) {

        if ( !inactive ) {
            inactive = true;
            console.log( 'player is inactive' );
        }

    } else if ( inactive ) {

        inactive = false;
        console.log( 'player came back' );

    }
}

function updateGameSize() {

    gameConfig.width = window.innerWidth;
    gameConfig.height = window.innerHeight;

    renderer.resize( gameConfig.width, gameConfig.height );

    var ratioW = gameConfig.width / gameConfig.baseSceneWidth;
    var ratioH = gameConfig.height / gameConfig.baseSceneHeight;

    if ( ratioW < ratioH ) {

        ratio = ratioW;
        dec.x = 0;
        dec.y = ( gameConfig.height - gameConfig.baseSceneHeight * ratio ) / 2;

    } else {

        ratio = ratioH;
        dec.x = ( gameConfig.width - gameConfig.baseSceneWidth * ratio ) / 2;
        dec.y = 0;

    }

    scene.scale = new PIXI.Point( ratio, ratio );
    scene.x = dec.x;
    scene.y = dec.y;

    background.width = gameConfig.width;
    background.height = gameConfig.height;

    physicsEngine.updateSceneResizeValues( dec, ratio );

}

function setPixelShaderSize( size ) {

    pixelateFilter.size.x = size;
    pixelateFilter.size.y = size;

}

function setRGBSplitFilterSize( time, size ) {

    size = size || 2;
    var value = time / 160;

    rgbSplitFilter.red = {
        x: Math.cos( value ) * size,
        y: Math.sin( value ) * size
    };

    rgbSplitFilter.green = {
        x: Math.cos( value + Math.PI * 2 / 3 ) * size,
        y: Math.sin( value + Math.PI * 2 / 3 ) * size
    };

    rgbSplitFilter.blue = {
        x: Math.cos( value + Math.PI * 4 / 3 ) * size,
        y: Math.sin( value + Math.PI * 4 / 3 ) * size
    };

}

function globalToSceneLocalX( x ) {
    return ( x - dec.x ) / ratio;
}

function globalToSceneLocalY( y ) {
    return ( y - dec.y ) / ratio;
}

function sceneLocalToGlobalX( x ) {
    return ( x + dec.x ) * ratio;
}

function sceneLocalToGlobalY( y ) {
    return ( y + dec.y ) * ratio;
}

function getScene() {
    return scene;
}

function getStage() {
    return stage;
}

function getDec() {
    return dec;
}

function getRatio() {
    return ratio;
}

module.exports = {
    init: init,
    setPixelShaderSize: setPixelShaderSize,
    getScene: getScene,
    getStage: getStage,
    globalToSceneLocalX: globalToSceneLocalX,
    globalToSceneLocalY: globalToSceneLocalY,
    sceneLocalToGlobalX: sceneLocalToGlobalX,
    sceneLocalToGlobalY: sceneLocalToGlobalY,    
    getDec: getDec,
    getRatio: getRatio
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/stageManager.js","/")
},{"./class/Scene":11,"buffer":1,"htZkx4":4}],21:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function init() {

}

function onSync( data ) {

    if ( data.event === 'createBall' ) {

        ballsManager.createBall( data );

    } else if ( data.event === 'updateBall' ) {

        ballsManager.updateBall( data );

        if ( data.collidingDirection === 't' ) {

            particlesManager.createBallCollideParticles( ballsManager.getBall( data.ID ), 90 );

        } else if ( data.collidingDirection === 'b' ) {

            particlesManager.createBallCollideParticles( ballsManager.getBall( data.ID ), 270 );

        } else if ( data.collidingDirection === 'l' ) {

            particlesManager.createBallCollideParticles( ballsManager.getBall( data.ID ), 0 );

        } else if ( data.collidingDirection === 'r' ) {

            particlesManager.createBallCollideParticles( ballsManager.getBall( data.ID ), 180 );

        }

    } else if ( data.event === 'setBallOut' ) {

        var outBall = ballsManager.getBall( data.ID );

        if ( outBall ) {

            ballsManager.setBallOut( outBall );

        }

    } else if ( data.event === 'destroyBall' ) {

        var destroyedBall = ballsManager.getBall( data.ID );

        if ( destroyedBall ) {

            destroyedBall.x = data.pos.x;
            destroyedBall.y = data.pos.y;
            ballsManager.destroyBall( destroyedBall );

        }

    } else if ( data.event === 'racketMove' ) {

        racketsManager.moveOpponentRacketTo( data.y, data.instant );

    }
}

function onCreateBall( ball ) {

    var data = {
        event: 'createBall',
        ID: ball.ID,
        color: ball.color,
        pos: {
            x: ball.x,
            y: ball.y
        },
        vel: {
            x: ball.vel.x,
            y: ball.vel.y,
        }
    };
    socketsManager.emit( 'sync', data );

}

function onUpdateBall( ball, collidingDirection ) {

    var data = {
        event: 'updateBall',
        ID: ball.ID,
        pos: {
            x: ball.x,
            y: ball.y
        },
        vel: {
            x: ball.vel.x,
            y: ball.vel.y,
        },
        collidingDirection: collidingDirection
    };
    socketsManager.emit( 'sync', data );

}

function onBallOut( ball ) {

    var data = {
        event: 'setBallOut',
        ID: ball.ID
    };
    socketsManager.emit( 'sync', data );

}

function onBallDestroy( ball ) {

    var data = {
        event: 'destroyBall',
        ID: ball.ID,
        pos: {
            x: ball.x,
            y: ball.y
        }
    };
    socketsManager.emit( 'sync', data );
}

function onRacketSetMovingToY( y, instant ) {

    var data = {
        event: 'racketMove',
        y: y,
        instant: instant
    };
    socketsManager.emit( 'sync', data );
    
}

module.exports = {
    init: init,
    onSync: onSync,
    onCreateBall: onCreateBall,
    onUpdateBall: onUpdateBall,
    onBallOut: onBallOut,
    onBallDestroy: onBallDestroy,
    onRacketSetMovingToY: onRacketSetMovingToY
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/syncManager.js","/")
},{"buffer":1,"htZkx4":4}],22:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var touch = -1,
    resetTimeout;


function init() {

    $( document ).on( 'touchstart', onTouchStart );
    $( document ).on( 'touchmove', onTouchMove );
    $( document ).on( 'touchend', onTouchEnd );

}

function update( delta ) {

    
}

function onTouchStart( event ) {

    clearTimeout(resetTimeout);
    touch = event.originalEvent.touches[0].clientY;

    console.log('touchstart');

}

function onTouchMove( event ) {

    var distance = gameConfig.height / (event.originalEvent.changedTouches[ 0 ].clientY - touch);
    console.log('touchmove', distance);

    racketsManager.movePlayerRacketTo( gameConfig.baseSceneHeight * 0.5 + gameConfig.baseSceneHeight * 2 / distance);

}

function onTouchEnd( event ) {

    touch = racketsManager.getPlayerRacketMovingToY;

    resetTimeout = setTimeout(function() {
        racketsManager.movePlayerRacketTo( gameConfig.baseSceneHeight * 0.5 );
    }, 150);

}


// function update( delta ) {

//     if ( touchStates.left && touchStates.right || !touchStates.left && !touchStates.right ) {

//         racketsManager.movePlayerRacketTo( gameConfig.baseSceneHeight * 0.5 );

//     } else if ( touchStates.left ) {

//         racketsManager.movePlayerRacketTo( gameConfig.baseSceneHeight );

//     } else if ( touchStates.right ) {

//         racketsManager.movePlayerRacketTo( 0 );

//     }
// }

// function onTouchStart( event ) {

//     for ( var i = event.originalEvent.touches.length - 1; i >= 0; i-- ) {

//         var side = event.originalEvent.touches[ i ].clientX < gameConfig.width / 2 ? 'left' : 'right';
//         touchStates[ side ] = true;
//         // console.log( side, touchStates[ side ], event.originalEvent.touches[ i ].clientX, gameConfig.width );

//     }

//     update();

// }

// function onTouchEnd( event ) {

//     var side = event.originalEvent.changedTouches[ 0 ].clientX < gameConfig.width / 2 ? 'left' : 'right';
//     touchStates[ side ] = false;
//     update();

// }

module.exports = {
    init: init,
    update: update
};

}).call(this,require("htZkx4"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/touchControlsManager.js","/")
},{"buffer":1,"htZkx4":4}]},{},[14])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcdmFscGNcXERvY3VtZW50c1xcZGV2XFxnaXRodWJcXG11bHRpcGxheWVyLXBvbmdcXG5vZGVfbW9kdWxlc1xcZ3VscC1icm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3Nlci1wYWNrXFxfcHJlbHVkZS5qcyIsIkM6L1VzZXJzL3ZhbHBjL0RvY3VtZW50cy9kZXYvZ2l0aHViL211bHRpcGxheWVyLXBvbmcvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiQzovVXNlcnMvdmFscGMvRG9jdW1lbnRzL2Rldi9naXRodWIvbXVsdGlwbGF5ZXItcG9uZy9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwiQzovVXNlcnMvdmFscGMvRG9jdW1lbnRzL2Rldi9naXRodWIvbXVsdGlwbGF5ZXItcG9uZy9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJDOi9Vc2Vycy92YWxwYy9Eb2N1bWVudHMvZGV2L2dpdGh1Yi9tdWx0aXBsYXllci1wb25nL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIkM6L1VzZXJzL3ZhbHBjL0RvY3VtZW50cy9kZXYvZ2l0aHViL211bHRpcGxheWVyLXBvbmcvbm9kZV9tb2R1bGVzL2xvZGFzaC9kaXN0L2xvZGFzaC5qcyIsIkM6L1VzZXJzL3ZhbHBjL0RvY3VtZW50cy9kZXYvZ2l0aHViL211bHRpcGxheWVyLXBvbmcvcHVibGljL2pzL3NyYy9hcHBNYW5hZ2VyLmpzIiwiQzovVXNlcnMvdmFscGMvRG9jdW1lbnRzL2Rldi9naXRodWIvbXVsdGlwbGF5ZXItcG9uZy9wdWJsaWMvanMvc3JjL2JhbGxzTWFuYWdlci5qcyIsIkM6L1VzZXJzL3ZhbHBjL0RvY3VtZW50cy9kZXYvZ2l0aHViL211bHRpcGxheWVyLXBvbmcvcHVibGljL2pzL3NyYy9jbGFzcy9CYWxsLmpzIiwiQzovVXNlcnMvdmFscGMvRG9jdW1lbnRzL2Rldi9naXRodWIvbXVsdGlwbGF5ZXItcG9uZy9wdWJsaWMvanMvc3JjL2NsYXNzL0h1ZC5qcyIsIkM6L1VzZXJzL3ZhbHBjL0RvY3VtZW50cy9kZXYvZ2l0aHViL211bHRpcGxheWVyLXBvbmcvcHVibGljL2pzL3NyYy9jbGFzcy9SYWNrZXQuanMiLCJDOi9Vc2Vycy92YWxwYy9Eb2N1bWVudHMvZGV2L2dpdGh1Yi9tdWx0aXBsYXllci1wb25nL3B1YmxpYy9qcy9zcmMvY2xhc3MvU2NlbmUuanMiLCJDOi9Vc2Vycy92YWxwYy9Eb2N1bWVudHMvZGV2L2dpdGh1Yi9tdWx0aXBsYXllci1wb25nL3B1YmxpYy9qcy9zcmMvY2xhc3MvVmVjdG9yMi5qcyIsIkM6L1VzZXJzL3ZhbHBjL0RvY3VtZW50cy9kZXYvZ2l0aHViL211bHRpcGxheWVyLXBvbmcvcHVibGljL2pzL3NyYy9kZXNrdG9wQ29udHJvbHNNYW5hZ2VyLmpzIiwiQzovVXNlcnMvdmFscGMvRG9jdW1lbnRzL2Rldi9naXRodWIvbXVsdGlwbGF5ZXItcG9uZy9wdWJsaWMvanMvc3JjL2Zha2VfZWY3NmRhYmEuanMiLCJDOi9Vc2Vycy92YWxwYy9Eb2N1bWVudHMvZGV2L2dpdGh1Yi9tdWx0aXBsYXllci1wb25nL3B1YmxpYy9qcy9zcmMvaHVkTWFuYWdlci5qcyIsIkM6L1VzZXJzL3ZhbHBjL0RvY3VtZW50cy9kZXYvZ2l0aHViL211bHRpcGxheWVyLXBvbmcvcHVibGljL2pzL3NyYy9wYXJ0aWNsZXNNYW5hZ2VyLmpzIiwiQzovVXNlcnMvdmFscGMvRG9jdW1lbnRzL2Rldi9naXRodWIvbXVsdGlwbGF5ZXItcG9uZy9wdWJsaWMvanMvc3JjL3BoeXNpY3NFbmdpbmUuanMiLCJDOi9Vc2Vycy92YWxwYy9Eb2N1bWVudHMvZGV2L2dpdGh1Yi9tdWx0aXBsYXllci1wb25nL3B1YmxpYy9qcy9zcmMvcmFja2V0c01hbmFnZXIuanMiLCJDOi9Vc2Vycy92YWxwYy9Eb2N1bWVudHMvZGV2L2dpdGh1Yi9tdWx0aXBsYXllci1wb25nL3B1YmxpYy9qcy9zcmMvc29ja2V0c01hbmFnZXIuanMiLCJDOi9Vc2Vycy92YWxwYy9Eb2N1bWVudHMvZGV2L2dpdGh1Yi9tdWx0aXBsYXllci1wb25nL3B1YmxpYy9qcy9zcmMvc3RhZ2VNYW5hZ2VyLmpzIiwiQzovVXNlcnMvdmFscGMvRG9jdW1lbnRzL2Rldi9naXRodWIvbXVsdGlwbGF5ZXItcG9uZy9wdWJsaWMvanMvc3JjL3N5bmNNYW5hZ2VyLmpzIiwiQzovVXNlcnMvdmFscGMvRG9jdW1lbnRzL2Rldi9naXRodWIvbXVsdGlwbGF5ZXItcG9uZy9wdWJsaWMvanMvc3JjL3RvdWNoQ29udHJvbHNNYW5hZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2bENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNub05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBXb3JrYXJvdW5kOiBub2RlJ3MgYmFzZTY0IGltcGxlbWVudGF0aW9uIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBzdHJpbmdzXG4gIC8vIHdoaWxlIGJhc2U2NC1qcyBkb2VzIG5vdC5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBzdHJpbmd0cmltKHN1YmplY3QpXG4gICAgd2hpbGUgKHN1YmplY3QubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgICAgc3ViamVjdCA9IHN1YmplY3QgKyAnPSdcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSlcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICAgIGVsc2VcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdFtpXVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0LCBbdG90YWxMZW5ndGhdKVxcbicgK1xuICAgICAgJ2xpc3Qgc2hvdWxkIGJlIGFuIEFycmF5LicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHRvdGFsTGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbi8vIEJVRkZFUiBJTlNUQU5DRSBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBfaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBhc3NlcnQoc3RyTGVuICUgMiA9PT0gMCwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGFzc2VydCghaXNOYU4oYnl0ZSksICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9IGkgKiAyXG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIF91dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gX2FzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuICBzdGFydCA9IE51bWJlcihzdGFydCkgfHwgMFxuICBlbmQgPSAoZW5kICE9PSB1bmRlZmluZWQpXG4gICAgPyBOdW1iZXIoZW5kKVxuICAgIDogZW5kID0gc2VsZi5sZW5ndGhcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgYXNzZXJ0KHRhcmdldF9zdGFydCA+PSAwICYmIHRhcmdldF9zdGFydCA8IHRhcmdldC5sZW5ndGgsXG4gICAgICAndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgc291cmNlLmxlbmd0aCwgJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIF91dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gX2FzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKVxuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBfYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gX2FzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBfaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpKzFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IGNsYW1wKHN0YXJ0LCBsZW4sIDApXG4gIGVuZCA9IGNsYW1wKGVuZCwgbGVuLCBsZW4pXG5cbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCxcbiAgICAgICAgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHZhciBuZWcgPSB0aGlzW29mZnNldF0gJiAweDgwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDE2KGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQzMihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwMDAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRGbG9hdCAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZERvdWJsZSAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmYpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm5cblxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgICAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmYsIC0weDgwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MTYoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLFxuICAgICAgICAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmNoYXJDb2RlQXQoMClcbiAgfVxuXG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICFpc05hTih2YWx1ZSksICd2YWx1ZSBpcyBub3QgYSBudW1iZXInKVxuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCB0aGlzLmxlbmd0aCwgJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHRoaXMubGVuZ3RoLCAnZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgdGhpc1tpXSA9IHZhbHVlXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSlcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG4vLyBzbGljZShzdGFydCwgZW5kKVxuZnVuY3Rpb24gY2xhbXAgKGluZGV4LCBsZW4sIGRlZmF1bHRWYWx1ZSkge1xuICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICBpbmRleCA9IH5+aW5kZXg7ICAvLyBDb2VyY2UgdG8gaW50ZWdlci5cbiAgaWYgKGluZGV4ID49IGxlbikgcmV0dXJuIGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIGluZGV4ICs9IGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGNvZXJjZSAobGVuZ3RoKSB7XG4gIC8vIENvZXJjZSBsZW5ndGggdG8gYSBudW1iZXIgKHBvc3NpYmx5IE5hTiksIHJvdW5kIHVwXG4gIC8vIGluIGNhc2UgaXQncyBmcmFjdGlvbmFsIChlLmcuIDEyMy40NTYpIHRoZW4gZG8gYVxuICAvLyBkb3VibGUgbmVnYXRlIHRvIGNvZXJjZSBhIE5hTiB0byAwLiBFYXN5LCByaWdodD9cbiAgbGVuZ3RoID0gfn5NYXRoLmNlaWwoK2xlbmd0aClcbiAgcmV0dXJuIGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKHN1YmplY3QpIHtcbiAgcmV0dXJuIChBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChzdWJqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdWJqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9KShzdWJqZWN0KVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKVxuICAgICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpXG4gICAgZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKVxuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBwb3NcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG5cbi8qXG4gKiBXZSBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGludGVnZXIuIFRoaXMgbWVhbnMgdGhhdCBpdFxuICogaXMgbm9uLW5lZ2F0aXZlLiBJdCBoYXMgbm8gZnJhY3Rpb25hbCBjb21wb25lbnQgYW5kIHRoYXQgaXQgZG9lcyBub3RcbiAqIGV4Y2VlZCB0aGUgbWF4aW11bSBhbGxvd2VkIHZhbHVlLlxuICovXG5mdW5jdGlvbiB2ZXJpZnVpbnQgKHZhbHVlLCBtYXgpIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlID49IDAsICdzcGVjaWZpZWQgYSBuZWdhdGl2ZSB2YWx1ZSBmb3Igd3JpdGluZyBhbiB1bnNpZ25lZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBpcyBsYXJnZXIgdGhhbiBtYXhpbXVtIHZhbHVlIGZvciB0eXBlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZzaW50ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZJRUVFNzU0ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0ZXN0LCBtZXNzYWdlKSB7XG4gIGlmICghdGVzdCkgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJ0ZhaWxlZCBhc3NlcnRpb24nKVxufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcImh0Wmt4NFwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uXFxcXC4uXFxcXC4uXFxcXG5vZGVfbW9kdWxlc1xcXFxndWxwLWJyb3dzZXJpZnlcXFxcbm9kZV9tb2R1bGVzXFxcXGJyb3dzZXJpZnlcXFxcbm9kZV9tb2R1bGVzXFxcXGJ1ZmZlclxcXFxpbmRleC5qc1wiLFwiLy4uXFxcXC4uXFxcXC4uXFxcXG5vZGVfbW9kdWxlc1xcXFxndWxwLWJyb3dzZXJpZnlcXFxcbm9kZV9tb2R1bGVzXFxcXGJyb3dzZXJpZnlcXFxcbm9kZV9tb2R1bGVzXFxcXGJ1ZmZlclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cdHZhciBQTFVTX1VSTF9TQUZFID0gJy0nLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIX1VSTF9TQUZFID0gJ18nLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUyB8fFxuXHRcdCAgICBjb2RlID09PSBQTFVTX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSCB8fFxuXHRcdCAgICBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcImh0Wmt4NFwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uXFxcXC4uXFxcXC4uXFxcXG5vZGVfbW9kdWxlc1xcXFxndWxwLWJyb3dzZXJpZnlcXFxcbm9kZV9tb2R1bGVzXFxcXGJyb3dzZXJpZnlcXFxcbm9kZV9tb2R1bGVzXFxcXGJ1ZmZlclxcXFxub2RlX21vZHVsZXNcXFxcYmFzZTY0LWpzXFxcXGxpYlxcXFxiNjQuanNcIixcIi8uLlxcXFwuLlxcXFwuLlxcXFxub2RlX21vZHVsZXNcXFxcZ3VscC1icm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxicm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxidWZmZXJcXFxcbm9kZV9tb2R1bGVzXFxcXGJhc2U2NC1qc1xcXFxsaWJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5leHBvcnRzLnJlYWQgPSBmdW5jdGlvbihidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIG5CaXRzID0gLTcsXG4gICAgICBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDAsXG4gICAgICBkID0gaXNMRSA/IC0xIDogMSxcbiAgICAgIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV07XG5cbiAgaSArPSBkO1xuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpO1xuICBzID4+PSAoLW5CaXRzKTtcbiAgbkJpdHMgKz0gZUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIGUgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBtTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXM7XG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KTtcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pO1xuICAgIGUgPSBlIC0gZUJpYXM7XG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbik7XG59O1xuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGMsXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApLFxuICAgICAgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpLFxuICAgICAgZCA9IGlzTEUgPyAxIDogLTEsXG4gICAgICBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwO1xuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpO1xuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwO1xuICAgIGUgPSBlTWF4O1xuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKTtcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS07XG4gICAgICBjICo9IDI7XG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcyk7XG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrO1xuICAgICAgYyAvPSAyO1xuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDA7XG4gICAgICBlID0gZU1heDtcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gZSArIGVCaWFzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gMDtcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KTtcblxuICBlID0gKGUgPDwgbUxlbikgfCBtO1xuICBlTGVuICs9IG1MZW47XG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCk7XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4O1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLlxcXFwuLlxcXFwuLlxcXFxub2RlX21vZHVsZXNcXFxcZ3VscC1icm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxicm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxidWZmZXJcXFxcbm9kZV9tb2R1bGVzXFxcXGllZWU3NTRcXFxcaW5kZXguanNcIixcIi8uLlxcXFwuLlxcXFwuLlxcXFxub2RlX21vZHVsZXNcXFxcZ3VscC1icm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxicm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxidWZmZXJcXFxcbm9kZV9tb2R1bGVzXFxcXGllZWU3NTRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLlxcXFwuLlxcXFwuLlxcXFxub2RlX21vZHVsZXNcXFxcZ3VscC1icm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxicm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxwcm9jZXNzXFxcXGJyb3dzZXIuanNcIixcIi8uLlxcXFwuLlxcXFwuLlxcXFxub2RlX21vZHVsZXNcXFxcZ3VscC1icm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxicm93c2VyaWZ5XFxcXG5vZGVfbW9kdWxlc1xcXFxwcm9jZXNzXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyoqXG4gKiBAbGljZW5zZVxuICogTG8tRGFzaCAyLjQuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cDovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIC1vIC4vZGlzdC9sb2Rhc2guanNgXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDEzIFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjUuMiA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTMgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cDovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuOyhmdW5jdGlvbigpIHtcblxuICAvKiogVXNlZCBhcyBhIHNhZmUgcmVmZXJlbmNlIGZvciBgdW5kZWZpbmVkYCBpbiBwcmUgRVM1IGVudmlyb25tZW50cyAqL1xuICB2YXIgdW5kZWZpbmVkO1xuXG4gIC8qKiBVc2VkIHRvIHBvb2wgYXJyYXlzIGFuZCBvYmplY3RzIHVzZWQgaW50ZXJuYWxseSAqL1xuICB2YXIgYXJyYXlQb29sID0gW10sXG4gICAgICBvYmplY3RQb29sID0gW107XG5cbiAgLyoqIFVzZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIElEcyAqL1xuICB2YXIgaWRDb3VudGVyID0gMDtcblxuICAvKiogVXNlZCB0byBwcmVmaXgga2V5cyB0byBhdm9pZCBpc3N1ZXMgd2l0aCBgX19wcm90b19fYCBhbmQgcHJvcGVydGllcyBvbiBgT2JqZWN0LnByb3RvdHlwZWAgKi9cbiAgdmFyIGtleVByZWZpeCA9ICtuZXcgRGF0ZSArICcnO1xuXG4gIC8qKiBVc2VkIGFzIHRoZSBzaXplIHdoZW4gb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZCBmb3IgbGFyZ2UgYXJyYXlzICovXG4gIHZhciBsYXJnZUFycmF5U2l6ZSA9IDc1O1xuXG4gIC8qKiBVc2VkIGFzIHRoZSBtYXggc2l6ZSBvZiB0aGUgYGFycmF5UG9vbGAgYW5kIGBvYmplY3RQb29sYCAqL1xuICB2YXIgbWF4UG9vbFNpemUgPSA0MDtcblxuICAvKiogVXNlZCB0byBkZXRlY3QgYW5kIHRlc3Qgd2hpdGVzcGFjZSAqL1xuICB2YXIgd2hpdGVzcGFjZSA9IChcbiAgICAvLyB3aGl0ZXNwYWNlXG4gICAgJyBcXHRcXHgwQlxcZlxceEEwXFx1ZmVmZicgK1xuXG4gICAgLy8gbGluZSB0ZXJtaW5hdG9yc1xuICAgICdcXG5cXHJcXHUyMDI4XFx1MjAyOScgK1xuXG4gICAgLy8gdW5pY29kZSBjYXRlZ29yeSBcIlpzXCIgc3BhY2Ugc2VwYXJhdG9yc1xuICAgICdcXHUxNjgwXFx1MTgwZVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBhXFx1MjAyZlxcdTIwNWZcXHUzMDAwJ1xuICApO1xuXG4gIC8qKiBVc2VkIHRvIG1hdGNoIGVtcHR5IHN0cmluZyBsaXRlcmFscyBpbiBjb21waWxlZCB0ZW1wbGF0ZSBzb3VyY2UgKi9cbiAgdmFyIHJlRW1wdHlTdHJpbmdMZWFkaW5nID0gL1xcYl9fcCBcXCs9ICcnOy9nLFxuICAgICAgcmVFbXB0eVN0cmluZ01pZGRsZSA9IC9cXGIoX19wIFxcKz0pICcnIFxcKy9nLFxuICAgICAgcmVFbXB0eVN0cmluZ1RyYWlsaW5nID0gLyhfX2VcXCguKj9cXCl8XFxiX190XFwpKSBcXCtcXG4nJzsvZztcblxuICAvKipcbiAgICogVXNlZCB0byBtYXRjaCBFUzYgdGVtcGxhdGUgZGVsaW1pdGVyc1xuICAgKiBodHRwOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy1saXRlcmFscy1zdHJpbmctbGl0ZXJhbHNcbiAgICovXG4gIHZhciByZUVzVGVtcGxhdGUgPSAvXFwkXFx7KFteXFxcXH1dKig/OlxcXFwuW15cXFxcfV0qKSopXFx9L2c7XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggcmVnZXhwIGZsYWdzIGZyb20gdGhlaXIgY29lcmNlZCBzdHJpbmcgdmFsdWVzICovXG4gIHZhciByZUZsYWdzID0gL1xcdyokLztcblxuICAvKiogVXNlZCB0byBkZXRlY3RlZCBuYW1lZCBmdW5jdGlvbnMgKi9cbiAgdmFyIHJlRnVuY05hbWUgPSAvXlxccypmdW5jdGlvblsgXFxuXFxyXFx0XStcXHcvO1xuXG4gIC8qKiBVc2VkIHRvIG1hdGNoIFwiaW50ZXJwb2xhdGVcIiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzICovXG4gIHZhciByZUludGVycG9sYXRlID0gLzwlPShbXFxzXFxTXSs/KSU+L2c7XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggbGVhZGluZyB3aGl0ZXNwYWNlIGFuZCB6ZXJvcyB0byBiZSByZW1vdmVkICovXG4gIHZhciByZUxlYWRpbmdTcGFjZXNBbmRaZXJvcyA9IFJlZ0V4cCgnXlsnICsgd2hpdGVzcGFjZSArICddKjArKD89LiQpJyk7XG5cbiAgLyoqIFVzZWQgdG8gZW5zdXJlIGNhcHR1cmluZyBvcmRlciBvZiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzICovXG4gIHZhciByZU5vTWF0Y2ggPSAvKCReKS87XG5cbiAgLyoqIFVzZWQgdG8gZGV0ZWN0IGZ1bmN0aW9ucyBjb250YWluaW5nIGEgYHRoaXNgIHJlZmVyZW5jZSAqL1xuICB2YXIgcmVUaGlzID0gL1xcYnRoaXNcXGIvO1xuXG4gIC8qKiBVc2VkIHRvIG1hdGNoIHVuZXNjYXBlZCBjaGFyYWN0ZXJzIGluIGNvbXBpbGVkIHN0cmluZyBsaXRlcmFscyAqL1xuICB2YXIgcmVVbmVzY2FwZWRTdHJpbmcgPSAvWydcXG5cXHJcXHRcXHUyMDI4XFx1MjAyOVxcXFxdL2c7XG5cbiAgLyoqIFVzZWQgdG8gYXNzaWduIGRlZmF1bHQgYGNvbnRleHRgIG9iamVjdCBwcm9wZXJ0aWVzICovXG4gIHZhciBjb250ZXh0UHJvcHMgPSBbXG4gICAgJ0FycmF5JywgJ0Jvb2xlYW4nLCAnRGF0ZScsICdGdW5jdGlvbicsICdNYXRoJywgJ051bWJlcicsICdPYmplY3QnLFxuICAgICdSZWdFeHAnLCAnU3RyaW5nJywgJ18nLCAnYXR0YWNoRXZlbnQnLCAnY2xlYXJUaW1lb3V0JywgJ2lzRmluaXRlJywgJ2lzTmFOJyxcbiAgICAncGFyc2VJbnQnLCAnc2V0VGltZW91dCdcbiAgXTtcblxuICAvKiogVXNlZCB0byBtYWtlIHRlbXBsYXRlIHNvdXJjZVVSTHMgZWFzaWVyIHRvIGlkZW50aWZ5ICovXG4gIHZhciB0ZW1wbGF0ZUNvdW50ZXIgPSAwO1xuXG4gIC8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgc2hvcnRjdXRzICovXG4gIHZhciBhcmdzQ2xhc3MgPSAnW29iamVjdCBBcmd1bWVudHNdJyxcbiAgICAgIGFycmF5Q2xhc3MgPSAnW29iamVjdCBBcnJheV0nLFxuICAgICAgYm9vbENsYXNzID0gJ1tvYmplY3QgQm9vbGVhbl0nLFxuICAgICAgZGF0ZUNsYXNzID0gJ1tvYmplY3QgRGF0ZV0nLFxuICAgICAgZnVuY0NsYXNzID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICAgIG51bWJlckNsYXNzID0gJ1tvYmplY3QgTnVtYmVyXScsXG4gICAgICBvYmplY3RDbGFzcyA9ICdbb2JqZWN0IE9iamVjdF0nLFxuICAgICAgcmVnZXhwQ2xhc3MgPSAnW29iamVjdCBSZWdFeHBdJyxcbiAgICAgIHN0cmluZ0NsYXNzID0gJ1tvYmplY3QgU3RyaW5nXSc7XG5cbiAgLyoqIFVzZWQgdG8gaWRlbnRpZnkgb2JqZWN0IGNsYXNzaWZpY2F0aW9ucyB0aGF0IGBfLmNsb25lYCBzdXBwb3J0cyAqL1xuICB2YXIgY2xvbmVhYmxlQ2xhc3NlcyA9IHt9O1xuICBjbG9uZWFibGVDbGFzc2VzW2Z1bmNDbGFzc10gPSBmYWxzZTtcbiAgY2xvbmVhYmxlQ2xhc3Nlc1thcmdzQ2xhc3NdID0gY2xvbmVhYmxlQ2xhc3Nlc1thcnJheUNsYXNzXSA9XG4gIGNsb25lYWJsZUNsYXNzZXNbYm9vbENsYXNzXSA9IGNsb25lYWJsZUNsYXNzZXNbZGF0ZUNsYXNzXSA9XG4gIGNsb25lYWJsZUNsYXNzZXNbbnVtYmVyQ2xhc3NdID0gY2xvbmVhYmxlQ2xhc3Nlc1tvYmplY3RDbGFzc10gPVxuICBjbG9uZWFibGVDbGFzc2VzW3JlZ2V4cENsYXNzXSA9IGNsb25lYWJsZUNsYXNzZXNbc3RyaW5nQ2xhc3NdID0gdHJ1ZTtcblxuICAvKiogVXNlZCBhcyBhbiBpbnRlcm5hbCBgXy5kZWJvdW5jZWAgb3B0aW9ucyBvYmplY3QgKi9cbiAgdmFyIGRlYm91bmNlT3B0aW9ucyA9IHtcbiAgICAnbGVhZGluZyc6IGZhbHNlLFxuICAgICdtYXhXYWl0JzogMCxcbiAgICAndHJhaWxpbmcnOiBmYWxzZVxuICB9O1xuXG4gIC8qKiBVc2VkIGFzIHRoZSBwcm9wZXJ0eSBkZXNjcmlwdG9yIGZvciBgX19iaW5kRGF0YV9fYCAqL1xuICB2YXIgZGVzY3JpcHRvciA9IHtcbiAgICAnY29uZmlndXJhYmxlJzogZmFsc2UsXG4gICAgJ2VudW1lcmFibGUnOiBmYWxzZSxcbiAgICAndmFsdWUnOiBudWxsLFxuICAgICd3cml0YWJsZSc6IGZhbHNlXG4gIH07XG5cbiAgLyoqIFVzZWQgdG8gZGV0ZXJtaW5lIGlmIHZhbHVlcyBhcmUgb2YgdGhlIGxhbmd1YWdlIHR5cGUgT2JqZWN0ICovXG4gIHZhciBvYmplY3RUeXBlcyA9IHtcbiAgICAnYm9vbGVhbic6IGZhbHNlLFxuICAgICdmdW5jdGlvbic6IHRydWUsXG4gICAgJ29iamVjdCc6IHRydWUsXG4gICAgJ251bWJlcic6IGZhbHNlLFxuICAgICdzdHJpbmcnOiBmYWxzZSxcbiAgICAndW5kZWZpbmVkJzogZmFsc2VcbiAgfTtcblxuICAvKiogVXNlZCB0byBlc2NhcGUgY2hhcmFjdGVycyBmb3IgaW5jbHVzaW9uIGluIGNvbXBpbGVkIHN0cmluZyBsaXRlcmFscyAqL1xuICB2YXIgc3RyaW5nRXNjYXBlcyA9IHtcbiAgICAnXFxcXCc6ICdcXFxcJyxcbiAgICBcIidcIjogXCInXCIsXG4gICAgJ1xcbic6ICduJyxcbiAgICAnXFxyJzogJ3InLFxuICAgICdcXHQnOiAndCcsXG4gICAgJ1xcdTIwMjgnOiAndTIwMjgnLFxuICAgICdcXHUyMDI5JzogJ3UyMDI5J1xuICB9O1xuXG4gIC8qKiBVc2VkIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0ICovXG4gIHZhciByb290ID0gKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdykgfHwgdGhpcztcblxuICAvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgICovXG4gIHZhciBmcmVlRXhwb3J0cyA9IG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlICYmIGV4cG9ydHM7XG5cbiAgLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBtb2R1bGVgICovXG4gIHZhciBmcmVlTW9kdWxlID0gb2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUgJiYgbW9kdWxlO1xuXG4gIC8qKiBEZXRlY3QgdGhlIHBvcHVsYXIgQ29tbW9uSlMgZXh0ZW5zaW9uIGBtb2R1bGUuZXhwb3J0c2AgKi9cbiAgdmFyIG1vZHVsZUV4cG9ydHMgPSBmcmVlTW9kdWxlICYmIGZyZWVNb2R1bGUuZXhwb3J0cyA9PT0gZnJlZUV4cG9ydHMgJiYgZnJlZUV4cG9ydHM7XG5cbiAgLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcyBvciBCcm93c2VyaWZpZWQgY29kZSBhbmQgdXNlIGl0IGFzIGByb290YCAqL1xuICB2YXIgZnJlZUdsb2JhbCA9IG9iamVjdFR5cGVzW3R5cGVvZiBnbG9iYWxdICYmIGdsb2JhbDtcbiAgaWYgKGZyZWVHbG9iYWwgJiYgKGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsIHx8IGZyZWVHbG9iYWwud2luZG93ID09PSBmcmVlR2xvYmFsKSkge1xuICAgIHJvb3QgPSBmcmVlR2xvYmFsO1xuICB9XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmluZGV4T2ZgIHdpdGhvdXQgc3VwcG9ydCBmb3IgYmluYXJ5IHNlYXJjaGVzXG4gICAqIG9yIGBmcm9tSW5kZXhgIGNvbnN0cmFpbnRzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBzZWFyY2ggZm9yLlxuICAgKiBAcGFyYW0ge251bWJlcn0gW2Zyb21JbmRleD0wXSBUaGUgaW5kZXggdG8gc2VhcmNoIGZyb20uXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBtYXRjaGVkIHZhbHVlIG9yIGAtMWAuXG4gICAqL1xuICBmdW5jdGlvbiBiYXNlSW5kZXhPZihhcnJheSwgdmFsdWUsIGZyb21JbmRleCkge1xuICAgIHZhciBpbmRleCA9IChmcm9tSW5kZXggfHwgMCkgLSAxLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgaWYgKGFycmF5W2luZGV4XSA9PT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICAvKipcbiAgICogQW4gaW1wbGVtZW50YXRpb24gb2YgYF8uY29udGFpbnNgIGZvciBjYWNoZSBvYmplY3RzIHRoYXQgbWltaWNzIHRoZSByZXR1cm5cbiAgICogc2lnbmF0dXJlIG9mIGBfLmluZGV4T2ZgIGJ5IHJldHVybmluZyBgMGAgaWYgdGhlIHZhbHVlIGlzIGZvdW5kLCBlbHNlIGAtMWAuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjYWNoZSBUaGUgY2FjaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHNlYXJjaCBmb3IuXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgYDBgIGlmIGB2YWx1ZWAgaXMgZm91bmQsIGVsc2UgYC0xYC5cbiAgICovXG4gIGZ1bmN0aW9uIGNhY2hlSW5kZXhPZihjYWNoZSwgdmFsdWUpIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgICBjYWNoZSA9IGNhY2hlLmNhY2hlO1xuXG4gICAgaWYgKHR5cGUgPT0gJ2Jvb2xlYW4nIHx8IHZhbHVlID09IG51bGwpIHtcbiAgICAgIHJldHVybiBjYWNoZVt2YWx1ZV0gPyAwIDogLTE7XG4gICAgfVxuICAgIGlmICh0eXBlICE9ICdudW1iZXInICYmIHR5cGUgIT0gJ3N0cmluZycpIHtcbiAgICAgIHR5cGUgPSAnb2JqZWN0JztcbiAgICB9XG4gICAgdmFyIGtleSA9IHR5cGUgPT0gJ251bWJlcicgPyB2YWx1ZSA6IGtleVByZWZpeCArIHZhbHVlO1xuICAgIGNhY2hlID0gKGNhY2hlID0gY2FjaGVbdHlwZV0pICYmIGNhY2hlW2tleV07XG5cbiAgICByZXR1cm4gdHlwZSA9PSAnb2JqZWN0J1xuICAgICAgPyAoY2FjaGUgJiYgYmFzZUluZGV4T2YoY2FjaGUsIHZhbHVlKSA+IC0xID8gMCA6IC0xKVxuICAgICAgOiAoY2FjaGUgPyAwIDogLTEpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBnaXZlbiB2YWx1ZSB0byB0aGUgY29ycmVzcG9uZGluZyBjYWNoZSBvYmplY3QuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGFkZCB0byB0aGUgY2FjaGUuXG4gICAqL1xuICBmdW5jdGlvbiBjYWNoZVB1c2godmFsdWUpIHtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLmNhY2hlLFxuICAgICAgICB0eXBlID0gdHlwZW9mIHZhbHVlO1xuXG4gICAgaWYgKHR5cGUgPT0gJ2Jvb2xlYW4nIHx8IHZhbHVlID09IG51bGwpIHtcbiAgICAgIGNhY2hlW3ZhbHVlXSA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlICE9ICdudW1iZXInICYmIHR5cGUgIT0gJ3N0cmluZycpIHtcbiAgICAgICAgdHlwZSA9ICdvYmplY3QnO1xuICAgICAgfVxuICAgICAgdmFyIGtleSA9IHR5cGUgPT0gJ251bWJlcicgPyB2YWx1ZSA6IGtleVByZWZpeCArIHZhbHVlLFxuICAgICAgICAgIHR5cGVDYWNoZSA9IGNhY2hlW3R5cGVdIHx8IChjYWNoZVt0eXBlXSA9IHt9KTtcblxuICAgICAgaWYgKHR5cGUgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgKHR5cGVDYWNoZVtrZXldIHx8ICh0eXBlQ2FjaGVba2V5XSA9IFtdKSkucHVzaCh2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0eXBlQ2FjaGVba2V5XSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgYnkgYF8ubWF4YCBhbmQgYF8ubWluYCBhcyB0aGUgZGVmYXVsdCBjYWxsYmFjayB3aGVuIGEgZ2l2ZW5cbiAgICogY29sbGVjdGlvbiBpcyBhIHN0cmluZyB2YWx1ZS5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIFRoZSBjaGFyYWN0ZXIgdG8gaW5zcGVjdC5cbiAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgY29kZSB1bml0IG9mIGdpdmVuIGNoYXJhY3Rlci5cbiAgICovXG4gIGZ1bmN0aW9uIGNoYXJBdENhbGxiYWNrKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlLmNoYXJDb2RlQXQoMCk7XG4gIH1cblxuICAvKipcbiAgICogVXNlZCBieSBgc29ydEJ5YCB0byBjb21wYXJlIHRyYW5zZm9ybWVkIGBjb2xsZWN0aW9uYCBlbGVtZW50cywgc3RhYmxlIHNvcnRpbmdcbiAgICogdGhlbSBpbiBhc2NlbmRpbmcgb3JkZXIuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBhIFRoZSBvYmplY3QgdG8gY29tcGFyZSB0byBgYmAuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBiIFRoZSBvYmplY3QgdG8gY29tcGFyZSB0byBgYWAuXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIHNvcnQgb3JkZXIgaW5kaWNhdG9yIG9mIGAxYCBvciBgLTFgLlxuICAgKi9cbiAgZnVuY3Rpb24gY29tcGFyZUFzY2VuZGluZyhhLCBiKSB7XG4gICAgdmFyIGFjID0gYS5jcml0ZXJpYSxcbiAgICAgICAgYmMgPSBiLmNyaXRlcmlhLFxuICAgICAgICBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhYy5sZW5ndGg7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgdmFyIHZhbHVlID0gYWNbaW5kZXhdLFxuICAgICAgICAgIG90aGVyID0gYmNbaW5kZXhdO1xuXG4gICAgICBpZiAodmFsdWUgIT09IG90aGVyKSB7XG4gICAgICAgIGlmICh2YWx1ZSA+IG90aGVyIHx8IHR5cGVvZiB2YWx1ZSA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIGlmICh2YWx1ZSA8IG90aGVyIHx8IHR5cGVvZiBvdGhlciA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBGaXhlcyBhbiBgQXJyYXkjc29ydGAgYnVnIGluIHRoZSBKUyBlbmdpbmUgZW1iZWRkZWQgaW4gQWRvYmUgYXBwbGljYXRpb25zXG4gICAgLy8gdGhhdCBjYXVzZXMgaXQsIHVuZGVyIGNlcnRhaW4gY2lyY3Vtc3RhbmNlcywgdG8gcmV0dXJuIHRoZSBzYW1lIHZhbHVlIGZvclxuICAgIC8vIGBhYCBhbmQgYGJgLiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phc2hrZW5hcy91bmRlcnNjb3JlL3B1bGwvMTI0N1xuICAgIC8vXG4gICAgLy8gVGhpcyBhbHNvIGVuc3VyZXMgYSBzdGFibGUgc29ydCBpbiBWOCBhbmQgb3RoZXIgZW5naW5lcy5cbiAgICAvLyBTZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9OTBcbiAgICByZXR1cm4gYS5pbmRleCAtIGIuaW5kZXg7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGNhY2hlIG9iamVjdCB0byBvcHRpbWl6ZSBsaW5lYXIgc2VhcmNoZXMgb2YgbGFyZ2UgYXJyYXlzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0FycmF5fSBbYXJyYXk9W11dIFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAqIEByZXR1cm5zIHtudWxsfE9iamVjdH0gUmV0dXJucyB0aGUgY2FjaGUgb2JqZWN0IG9yIGBudWxsYCBpZiBjYWNoaW5nIHNob3VsZCBub3QgYmUgdXNlZC5cbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZUNhY2hlKGFycmF5KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCxcbiAgICAgICAgZmlyc3QgPSBhcnJheVswXSxcbiAgICAgICAgbWlkID0gYXJyYXlbKGxlbmd0aCAvIDIpIHwgMF0sXG4gICAgICAgIGxhc3QgPSBhcnJheVtsZW5ndGggLSAxXTtcblxuICAgIGlmIChmaXJzdCAmJiB0eXBlb2YgZmlyc3QgPT0gJ29iamVjdCcgJiZcbiAgICAgICAgbWlkICYmIHR5cGVvZiBtaWQgPT0gJ29iamVjdCcgJiYgbGFzdCAmJiB0eXBlb2YgbGFzdCA9PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB2YXIgY2FjaGUgPSBnZXRPYmplY3QoKTtcbiAgICBjYWNoZVsnZmFsc2UnXSA9IGNhY2hlWydudWxsJ10gPSBjYWNoZVsndHJ1ZSddID0gY2FjaGVbJ3VuZGVmaW5lZCddID0gZmFsc2U7XG5cbiAgICB2YXIgcmVzdWx0ID0gZ2V0T2JqZWN0KCk7XG4gICAgcmVzdWx0LmFycmF5ID0gYXJyYXk7XG4gICAgcmVzdWx0LmNhY2hlID0gY2FjaGU7XG4gICAgcmVzdWx0LnB1c2ggPSBjYWNoZVB1c2g7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgcmVzdWx0LnB1c2goYXJyYXlbaW5kZXhdKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBVc2VkIGJ5IGB0ZW1wbGF0ZWAgdG8gZXNjYXBlIGNoYXJhY3RlcnMgZm9yIGluY2x1c2lvbiBpbiBjb21waWxlZFxuICAgKiBzdHJpbmcgbGl0ZXJhbHMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBtYXRjaCBUaGUgbWF0Y2hlZCBjaGFyYWN0ZXIgdG8gZXNjYXBlLlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBlc2NhcGVkIGNoYXJhY3Rlci5cbiAgICovXG4gIGZ1bmN0aW9uIGVzY2FwZVN0cmluZ0NoYXIobWF0Y2gpIHtcbiAgICByZXR1cm4gJ1xcXFwnICsgc3RyaW5nRXNjYXBlc1ttYXRjaF07XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhbiBhcnJheSBmcm9tIHRoZSBhcnJheSBwb29sIG9yIGNyZWF0ZXMgYSBuZXcgb25lIGlmIHRoZSBwb29sIGlzIGVtcHR5LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFRoZSBhcnJheSBmcm9tIHRoZSBwb29sLlxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0QXJyYXkoKSB7XG4gICAgcmV0dXJuIGFycmF5UG9vbC5wb3AoKSB8fCBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGFuIG9iamVjdCBmcm9tIHRoZSBvYmplY3QgcG9vbCBvciBjcmVhdGVzIGEgbmV3IG9uZSBpZiB0aGUgcG9vbCBpcyBlbXB0eS5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge09iamVjdH0gVGhlIG9iamVjdCBmcm9tIHRoZSBwb29sLlxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0T2JqZWN0KCkge1xuICAgIHJldHVybiBvYmplY3RQb29sLnBvcCgpIHx8IHtcbiAgICAgICdhcnJheSc6IG51bGwsXG4gICAgICAnY2FjaGUnOiBudWxsLFxuICAgICAgJ2NyaXRlcmlhJzogbnVsbCxcbiAgICAgICdmYWxzZSc6IGZhbHNlLFxuICAgICAgJ2luZGV4JzogMCxcbiAgICAgICdudWxsJzogZmFsc2UsXG4gICAgICAnbnVtYmVyJzogbnVsbCxcbiAgICAgICdvYmplY3QnOiBudWxsLFxuICAgICAgJ3B1c2gnOiBudWxsLFxuICAgICAgJ3N0cmluZyc6IG51bGwsXG4gICAgICAndHJ1ZSc6IGZhbHNlLFxuICAgICAgJ3VuZGVmaW5lZCc6IGZhbHNlLFxuICAgICAgJ3ZhbHVlJzogbnVsbFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUmVsZWFzZXMgdGhlIGdpdmVuIGFycmF5IGJhY2sgdG8gdGhlIGFycmF5IHBvb2wuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7QXJyYXl9IFthcnJheV0gVGhlIGFycmF5IHRvIHJlbGVhc2UuXG4gICAqL1xuICBmdW5jdGlvbiByZWxlYXNlQXJyYXkoYXJyYXkpIHtcbiAgICBhcnJheS5sZW5ndGggPSAwO1xuICAgIGlmIChhcnJheVBvb2wubGVuZ3RoIDwgbWF4UG9vbFNpemUpIHtcbiAgICAgIGFycmF5UG9vbC5wdXNoKGFycmF5KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVsZWFzZXMgdGhlIGdpdmVuIG9iamVjdCBiYWNrIHRvIHRoZSBvYmplY3QgcG9vbC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvYmplY3RdIFRoZSBvYmplY3QgdG8gcmVsZWFzZS5cbiAgICovXG4gIGZ1bmN0aW9uIHJlbGVhc2VPYmplY3Qob2JqZWN0KSB7XG4gICAgdmFyIGNhY2hlID0gb2JqZWN0LmNhY2hlO1xuICAgIGlmIChjYWNoZSkge1xuICAgICAgcmVsZWFzZU9iamVjdChjYWNoZSk7XG4gICAgfVxuICAgIG9iamVjdC5hcnJheSA9IG9iamVjdC5jYWNoZSA9IG9iamVjdC5jcml0ZXJpYSA9IG9iamVjdC5vYmplY3QgPSBvYmplY3QubnVtYmVyID0gb2JqZWN0LnN0cmluZyA9IG9iamVjdC52YWx1ZSA9IG51bGw7XG4gICAgaWYgKG9iamVjdFBvb2wubGVuZ3RoIDwgbWF4UG9vbFNpemUpIHtcbiAgICAgIG9iamVjdFBvb2wucHVzaChvYmplY3QpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTbGljZXMgdGhlIGBjb2xsZWN0aW9uYCBmcm9tIHRoZSBgc3RhcnRgIGluZGV4IHVwIHRvLCBidXQgbm90IGluY2x1ZGluZyxcbiAgICogdGhlIGBlbmRgIGluZGV4LlxuICAgKlxuICAgKiBOb3RlOiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgaW5zdGVhZCBvZiBgQXJyYXkjc2xpY2VgIHRvIHN1cHBvcnQgbm9kZSBsaXN0c1xuICAgKiBpbiBJRSA8IDkgYW5kIHRvIGVuc3VyZSBkZW5zZSBhcnJheXMgYXJlIHJldHVybmVkLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gc2xpY2UuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCBUaGUgc3RhcnQgaW5kZXguXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBlbmQgVGhlIGVuZCBpbmRleC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBuZXcgYXJyYXkuXG4gICAqL1xuICBmdW5jdGlvbiBzbGljZShhcnJheSwgc3RhcnQsIGVuZCkge1xuICAgIHN0YXJ0IHx8IChzdGFydCA9IDApO1xuICAgIGlmICh0eXBlb2YgZW5kID09ICd1bmRlZmluZWQnKSB7XG4gICAgICBlbmQgPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XG4gICAgfVxuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBlbmQgLSBzdGFydCB8fCAwLFxuICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGggPCAwID8gMCA6IGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgcmVzdWx0W2luZGV4XSA9IGFycmF5W3N0YXJ0ICsgaW5kZXhdO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBgbG9kYXNoYCBmdW5jdGlvbiB1c2luZyB0aGUgZ2l2ZW4gY29udGV4dCBvYmplY3QuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbnRleHQ9cm9vdF0gVGhlIGNvbnRleHQgb2JqZWN0LlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIGBsb2Rhc2hgIGZ1bmN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gcnVuSW5Db250ZXh0KGNvbnRleHQpIHtcbiAgICAvLyBBdm9pZCBpc3N1ZXMgd2l0aCBzb21lIEVTMyBlbnZpcm9ubWVudHMgdGhhdCBhdHRlbXB0IHRvIHVzZSB2YWx1ZXMsIG5hbWVkXG4gICAgLy8gYWZ0ZXIgYnVpbHQtaW4gY29uc3RydWN0b3JzIGxpa2UgYE9iamVjdGAsIGZvciB0aGUgY3JlYXRpb24gb2YgbGl0ZXJhbHMuXG4gICAgLy8gRVM1IGNsZWFycyB0aGlzIHVwIGJ5IHN0YXRpbmcgdGhhdCBsaXRlcmFscyBtdXN0IHVzZSBidWlsdC1pbiBjb25zdHJ1Y3RvcnMuXG4gICAgLy8gU2VlIGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4MTEuMS41LlxuICAgIGNvbnRleHQgPSBjb250ZXh0ID8gXy5kZWZhdWx0cyhyb290Lk9iamVjdCgpLCBjb250ZXh0LCBfLnBpY2socm9vdCwgY29udGV4dFByb3BzKSkgOiByb290O1xuXG4gICAgLyoqIE5hdGl2ZSBjb25zdHJ1Y3RvciByZWZlcmVuY2VzICovXG4gICAgdmFyIEFycmF5ID0gY29udGV4dC5BcnJheSxcbiAgICAgICAgQm9vbGVhbiA9IGNvbnRleHQuQm9vbGVhbixcbiAgICAgICAgRGF0ZSA9IGNvbnRleHQuRGF0ZSxcbiAgICAgICAgRnVuY3Rpb24gPSBjb250ZXh0LkZ1bmN0aW9uLFxuICAgICAgICBNYXRoID0gY29udGV4dC5NYXRoLFxuICAgICAgICBOdW1iZXIgPSBjb250ZXh0Lk51bWJlcixcbiAgICAgICAgT2JqZWN0ID0gY29udGV4dC5PYmplY3QsXG4gICAgICAgIFJlZ0V4cCA9IGNvbnRleHQuUmVnRXhwLFxuICAgICAgICBTdHJpbmcgPSBjb250ZXh0LlN0cmluZyxcbiAgICAgICAgVHlwZUVycm9yID0gY29udGV4dC5UeXBlRXJyb3I7XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIGZvciBgQXJyYXlgIG1ldGhvZCByZWZlcmVuY2VzLlxuICAgICAqXG4gICAgICogTm9ybWFsbHkgYEFycmF5LnByb3RvdHlwZWAgd291bGQgc3VmZmljZSwgaG93ZXZlciwgdXNpbmcgYW4gYXJyYXkgbGl0ZXJhbFxuICAgICAqIGF2b2lkcyBpc3N1ZXMgaW4gTmFyd2hhbC5cbiAgICAgKi9cbiAgICB2YXIgYXJyYXlSZWYgPSBbXTtcblxuICAgIC8qKiBVc2VkIGZvciBuYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMgKi9cbiAgICB2YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4gICAgLyoqIFVzZWQgdG8gcmVzdG9yZSB0aGUgb3JpZ2luYWwgYF9gIHJlZmVyZW5jZSBpbiBgbm9Db25mbGljdGAgKi9cbiAgICB2YXIgb2xkRGFzaCA9IGNvbnRleHQuXztcblxuICAgIC8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGludGVybmFsIFtbQ2xhc3NdXSBvZiB2YWx1ZXMgKi9cbiAgICB2YXIgdG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuICAgIC8qKiBVc2VkIHRvIGRldGVjdCBpZiBhIG1ldGhvZCBpcyBuYXRpdmUgKi9cbiAgICB2YXIgcmVOYXRpdmUgPSBSZWdFeHAoJ14nICtcbiAgICAgIFN0cmluZyh0b1N0cmluZylcbiAgICAgICAgLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJylcbiAgICAgICAgLnJlcGxhY2UoL3RvU3RyaW5nfCBmb3IgW15cXF1dKy9nLCAnLio/JykgKyAnJCdcbiAgICApO1xuXG4gICAgLyoqIE5hdGl2ZSBtZXRob2Qgc2hvcnRjdXRzICovXG4gICAgdmFyIGNlaWwgPSBNYXRoLmNlaWwsXG4gICAgICAgIGNsZWFyVGltZW91dCA9IGNvbnRleHQuY2xlYXJUaW1lb3V0LFxuICAgICAgICBmbG9vciA9IE1hdGguZmxvb3IsXG4gICAgICAgIGZuVG9TdHJpbmcgPSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmcsXG4gICAgICAgIGdldFByb3RvdHlwZU9mID0gaXNOYXRpdmUoZ2V0UHJvdG90eXBlT2YgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YpICYmIGdldFByb3RvdHlwZU9mLFxuICAgICAgICBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5LFxuICAgICAgICBwdXNoID0gYXJyYXlSZWYucHVzaCxcbiAgICAgICAgc2V0VGltZW91dCA9IGNvbnRleHQuc2V0VGltZW91dCxcbiAgICAgICAgc3BsaWNlID0gYXJyYXlSZWYuc3BsaWNlLFxuICAgICAgICB1bnNoaWZ0ID0gYXJyYXlSZWYudW5zaGlmdDtcblxuICAgIC8qKiBVc2VkIHRvIHNldCBtZXRhIGRhdGEgb24gZnVuY3Rpb25zICovXG4gICAgdmFyIGRlZmluZVByb3BlcnR5ID0gKGZ1bmN0aW9uKCkge1xuICAgICAgLy8gSUUgOCBvbmx5IGFjY2VwdHMgRE9NIGVsZW1lbnRzXG4gICAgICB0cnkge1xuICAgICAgICB2YXIgbyA9IHt9LFxuICAgICAgICAgICAgZnVuYyA9IGlzTmF0aXZlKGZ1bmMgPSBPYmplY3QuZGVmaW5lUHJvcGVydHkpICYmIGZ1bmMsXG4gICAgICAgICAgICByZXN1bHQgPSBmdW5jKG8sIG8sIG8pICYmIGZ1bmM7XG4gICAgICB9IGNhdGNoKGUpIHsgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9KCkpO1xuXG4gICAgLyogTmF0aXZlIG1ldGhvZCBzaG9ydGN1dHMgZm9yIG1ldGhvZHMgd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMgKi9cbiAgICB2YXIgbmF0aXZlQ3JlYXRlID0gaXNOYXRpdmUobmF0aXZlQ3JlYXRlID0gT2JqZWN0LmNyZWF0ZSkgJiYgbmF0aXZlQ3JlYXRlLFxuICAgICAgICBuYXRpdmVJc0FycmF5ID0gaXNOYXRpdmUobmF0aXZlSXNBcnJheSA9IEFycmF5LmlzQXJyYXkpICYmIG5hdGl2ZUlzQXJyYXksXG4gICAgICAgIG5hdGl2ZUlzRmluaXRlID0gY29udGV4dC5pc0Zpbml0ZSxcbiAgICAgICAgbmF0aXZlSXNOYU4gPSBjb250ZXh0LmlzTmFOLFxuICAgICAgICBuYXRpdmVLZXlzID0gaXNOYXRpdmUobmF0aXZlS2V5cyA9IE9iamVjdC5rZXlzKSAmJiBuYXRpdmVLZXlzLFxuICAgICAgICBuYXRpdmVNYXggPSBNYXRoLm1heCxcbiAgICAgICAgbmF0aXZlTWluID0gTWF0aC5taW4sXG4gICAgICAgIG5hdGl2ZVBhcnNlSW50ID0gY29udGV4dC5wYXJzZUludCxcbiAgICAgICAgbmF0aXZlUmFuZG9tID0gTWF0aC5yYW5kb207XG5cbiAgICAvKiogVXNlZCB0byBsb29rdXAgYSBidWlsdC1pbiBjb25zdHJ1Y3RvciBieSBbW0NsYXNzXV0gKi9cbiAgICB2YXIgY3RvckJ5Q2xhc3MgPSB7fTtcbiAgICBjdG9yQnlDbGFzc1thcnJheUNsYXNzXSA9IEFycmF5O1xuICAgIGN0b3JCeUNsYXNzW2Jvb2xDbGFzc10gPSBCb29sZWFuO1xuICAgIGN0b3JCeUNsYXNzW2RhdGVDbGFzc10gPSBEYXRlO1xuICAgIGN0b3JCeUNsYXNzW2Z1bmNDbGFzc10gPSBGdW5jdGlvbjtcbiAgICBjdG9yQnlDbGFzc1tvYmplY3RDbGFzc10gPSBPYmplY3Q7XG4gICAgY3RvckJ5Q2xhc3NbbnVtYmVyQ2xhc3NdID0gTnVtYmVyO1xuICAgIGN0b3JCeUNsYXNzW3JlZ2V4cENsYXNzXSA9IFJlZ0V4cDtcbiAgICBjdG9yQnlDbGFzc1tzdHJpbmdDbGFzc10gPSBTdHJpbmc7XG5cbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBgbG9kYXNoYCBvYmplY3Qgd2hpY2ggd3JhcHMgdGhlIGdpdmVuIHZhbHVlIHRvIGVuYWJsZSBpbnR1aXRpdmVcbiAgICAgKiBtZXRob2QgY2hhaW5pbmcuXG4gICAgICpcbiAgICAgKiBJbiBhZGRpdGlvbiB0byBMby1EYXNoIG1ldGhvZHMsIHdyYXBwZXJzIGFsc28gaGF2ZSB0aGUgZm9sbG93aW5nIGBBcnJheWAgbWV0aG9kczpcbiAgICAgKiBgY29uY2F0YCwgYGpvaW5gLCBgcG9wYCwgYHB1c2hgLCBgcmV2ZXJzZWAsIGBzaGlmdGAsIGBzbGljZWAsIGBzb3J0YCwgYHNwbGljZWAsXG4gICAgICogYW5kIGB1bnNoaWZ0YFxuICAgICAqXG4gICAgICogQ2hhaW5pbmcgaXMgc3VwcG9ydGVkIGluIGN1c3RvbSBidWlsZHMgYXMgbG9uZyBhcyB0aGUgYHZhbHVlYCBtZXRob2QgaXNcbiAgICAgKiBpbXBsaWNpdGx5IG9yIGV4cGxpY2l0bHkgaW5jbHVkZWQgaW4gdGhlIGJ1aWxkLlxuICAgICAqXG4gICAgICogVGhlIGNoYWluYWJsZSB3cmFwcGVyIGZ1bmN0aW9ucyBhcmU6XG4gICAgICogYGFmdGVyYCwgYGFzc2lnbmAsIGBiaW5kYCwgYGJpbmRBbGxgLCBgYmluZEtleWAsIGBjaGFpbmAsIGBjb21wYWN0YCxcbiAgICAgKiBgY29tcG9zZWAsIGBjb25jYXRgLCBgY291bnRCeWAsIGBjcmVhdGVgLCBgY3JlYXRlQ2FsbGJhY2tgLCBgY3VycnlgLFxuICAgICAqIGBkZWJvdW5jZWAsIGBkZWZhdWx0c2AsIGBkZWZlcmAsIGBkZWxheWAsIGBkaWZmZXJlbmNlYCwgYGZpbHRlcmAsIGBmbGF0dGVuYCxcbiAgICAgKiBgZm9yRWFjaGAsIGBmb3JFYWNoUmlnaHRgLCBgZm9ySW5gLCBgZm9ySW5SaWdodGAsIGBmb3JPd25gLCBgZm9yT3duUmlnaHRgLFxuICAgICAqIGBmdW5jdGlvbnNgLCBgZ3JvdXBCeWAsIGBpbmRleEJ5YCwgYGluaXRpYWxgLCBgaW50ZXJzZWN0aW9uYCwgYGludmVydGAsXG4gICAgICogYGludm9rZWAsIGBrZXlzYCwgYG1hcGAsIGBtYXhgLCBgbWVtb2l6ZWAsIGBtZXJnZWAsIGBtaW5gLCBgb2JqZWN0YCwgYG9taXRgLFxuICAgICAqIGBvbmNlYCwgYHBhaXJzYCwgYHBhcnRpYWxgLCBgcGFydGlhbFJpZ2h0YCwgYHBpY2tgLCBgcGx1Y2tgLCBgcHVsbGAsIGBwdXNoYCxcbiAgICAgKiBgcmFuZ2VgLCBgcmVqZWN0YCwgYHJlbW92ZWAsIGByZXN0YCwgYHJldmVyc2VgLCBgc2h1ZmZsZWAsIGBzbGljZWAsIGBzb3J0YCxcbiAgICAgKiBgc29ydEJ5YCwgYHNwbGljZWAsIGB0YXBgLCBgdGhyb3R0bGVgLCBgdGltZXNgLCBgdG9BcnJheWAsIGB0cmFuc2Zvcm1gLFxuICAgICAqIGB1bmlvbmAsIGB1bmlxYCwgYHVuc2hpZnRgLCBgdW56aXBgLCBgdmFsdWVzYCwgYHdoZXJlYCwgYHdpdGhvdXRgLCBgd3JhcGAsXG4gICAgICogYW5kIGB6aXBgXG4gICAgICpcbiAgICAgKiBUaGUgbm9uLWNoYWluYWJsZSB3cmFwcGVyIGZ1bmN0aW9ucyBhcmU6XG4gICAgICogYGNsb25lYCwgYGNsb25lRGVlcGAsIGBjb250YWluc2AsIGBlc2NhcGVgLCBgZXZlcnlgLCBgZmluZGAsIGBmaW5kSW5kZXhgLFxuICAgICAqIGBmaW5kS2V5YCwgYGZpbmRMYXN0YCwgYGZpbmRMYXN0SW5kZXhgLCBgZmluZExhc3RLZXlgLCBgaGFzYCwgYGlkZW50aXR5YCxcbiAgICAgKiBgaW5kZXhPZmAsIGBpc0FyZ3VtZW50c2AsIGBpc0FycmF5YCwgYGlzQm9vbGVhbmAsIGBpc0RhdGVgLCBgaXNFbGVtZW50YCxcbiAgICAgKiBgaXNFbXB0eWAsIGBpc0VxdWFsYCwgYGlzRmluaXRlYCwgYGlzRnVuY3Rpb25gLCBgaXNOYU5gLCBgaXNOdWxsYCwgYGlzTnVtYmVyYCxcbiAgICAgKiBgaXNPYmplY3RgLCBgaXNQbGFpbk9iamVjdGAsIGBpc1JlZ0V4cGAsIGBpc1N0cmluZ2AsIGBpc1VuZGVmaW5lZGAsIGBqb2luYCxcbiAgICAgKiBgbGFzdEluZGV4T2ZgLCBgbWl4aW5gLCBgbm9Db25mbGljdGAsIGBwYXJzZUludGAsIGBwb3BgLCBgcmFuZG9tYCwgYHJlZHVjZWAsXG4gICAgICogYHJlZHVjZVJpZ2h0YCwgYHJlc3VsdGAsIGBzaGlmdGAsIGBzaXplYCwgYHNvbWVgLCBgc29ydGVkSW5kZXhgLCBgcnVuSW5Db250ZXh0YCxcbiAgICAgKiBgdGVtcGxhdGVgLCBgdW5lc2NhcGVgLCBgdW5pcXVlSWRgLCBhbmQgYHZhbHVlYFxuICAgICAqXG4gICAgICogVGhlIHdyYXBwZXIgZnVuY3Rpb25zIGBmaXJzdGAgYW5kIGBsYXN0YCByZXR1cm4gd3JhcHBlZCB2YWx1ZXMgd2hlbiBgbmAgaXNcbiAgICAgKiBwcm92aWRlZCwgb3RoZXJ3aXNlIHRoZXkgcmV0dXJuIHVud3JhcHBlZCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBFeHBsaWNpdCBjaGFpbmluZyBjYW4gYmUgZW5hYmxlZCBieSB1c2luZyB0aGUgYF8uY2hhaW5gIG1ldGhvZC5cbiAgICAgKlxuICAgICAqIEBuYW1lIF9cbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAY2F0ZWdvcnkgQ2hhaW5pbmdcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byB3cmFwIGluIGEgYGxvZGFzaGAgaW5zdGFuY2UuXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhIGBsb2Rhc2hgIGluc3RhbmNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgd3JhcHBlZCA9IF8oWzEsIDIsIDNdKTtcbiAgICAgKlxuICAgICAqIC8vIHJldHVybnMgYW4gdW53cmFwcGVkIHZhbHVlXG4gICAgICogd3JhcHBlZC5yZWR1Y2UoZnVuY3Rpb24oc3VtLCBudW0pIHtcbiAgICAgKiAgIHJldHVybiBzdW0gKyBudW07XG4gICAgICogfSk7XG4gICAgICogLy8gPT4gNlxuICAgICAqXG4gICAgICogLy8gcmV0dXJucyBhIHdyYXBwZWQgdmFsdWVcbiAgICAgKiB2YXIgc3F1YXJlcyA9IHdyYXBwZWQubWFwKGZ1bmN0aW9uKG51bSkge1xuICAgICAqICAgcmV0dXJuIG51bSAqIG51bTtcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIF8uaXNBcnJheShzcXVhcmVzKTtcbiAgICAgKiAvLyA9PiBmYWxzZVxuICAgICAqXG4gICAgICogXy5pc0FycmF5KHNxdWFyZXMudmFsdWUoKSk7XG4gICAgICogLy8gPT4gdHJ1ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGxvZGFzaCh2YWx1ZSkge1xuICAgICAgLy8gZG9uJ3Qgd3JhcCBpZiBhbHJlYWR5IHdyYXBwZWQsIGV2ZW4gaWYgd3JhcHBlZCBieSBhIGRpZmZlcmVudCBgbG9kYXNoYCBjb25zdHJ1Y3RvclxuICAgICAgcmV0dXJuICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcgJiYgIWlzQXJyYXkodmFsdWUpICYmIGhhc093blByb3BlcnR5LmNhbGwodmFsdWUsICdfX3dyYXBwZWRfXycpKVxuICAgICAgID8gdmFsdWVcbiAgICAgICA6IG5ldyBsb2Rhc2hXcmFwcGVyKHZhbHVlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGZhc3QgcGF0aCBmb3IgY3JlYXRpbmcgYGxvZGFzaGAgd3JhcHBlciBvYmplY3RzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byB3cmFwIGluIGEgYGxvZGFzaGAgaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBjaGFpbkFsbCBBIGZsYWcgdG8gZW5hYmxlIGNoYWluaW5nIGZvciBhbGwgbWV0aG9kc1xuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYSBgbG9kYXNoYCBpbnN0YW5jZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBsb2Rhc2hXcmFwcGVyKHZhbHVlLCBjaGFpbkFsbCkge1xuICAgICAgdGhpcy5fX2NoYWluX18gPSAhIWNoYWluQWxsO1xuICAgICAgdGhpcy5fX3dyYXBwZWRfXyA9IHZhbHVlO1xuICAgIH1cbiAgICAvLyBlbnN1cmUgYG5ldyBsb2Rhc2hXcmFwcGVyYCBpcyBhbiBpbnN0YW5jZSBvZiBgbG9kYXNoYFxuICAgIGxvZGFzaFdyYXBwZXIucHJvdG90eXBlID0gbG9kYXNoLnByb3RvdHlwZTtcblxuICAgIC8qKlxuICAgICAqIEFuIG9iamVjdCB1c2VkIHRvIGZsYWcgZW52aXJvbm1lbnRzIGZlYXR1cmVzLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICovXG4gICAgdmFyIHN1cHBvcnQgPSBsb2Rhc2guc3VwcG9ydCA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogRGV0ZWN0IGlmIGZ1bmN0aW9ucyBjYW4gYmUgZGVjb21waWxlZCBieSBgRnVuY3Rpb24jdG9TdHJpbmdgXG4gICAgICogKGFsbCBidXQgUFMzIGFuZCBvbGRlciBPcGVyYSBtb2JpbGUgYnJvd3NlcnMgJiBhdm9pZGVkIGluIFdpbmRvd3MgOCBhcHBzKS5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBfLnN1cHBvcnRcbiAgICAgKiBAdHlwZSBib29sZWFuXG4gICAgICovXG4gICAgc3VwcG9ydC5mdW5jRGVjb21wID0gIWlzTmF0aXZlKGNvbnRleHQuV2luUlRFcnJvcikgJiYgcmVUaGlzLnRlc3QocnVuSW5Db250ZXh0KTtcblxuICAgIC8qKlxuICAgICAqIERldGVjdCBpZiBgRnVuY3Rpb24jbmFtZWAgaXMgc3VwcG9ydGVkIChhbGwgYnV0IElFKS5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBfLnN1cHBvcnRcbiAgICAgKiBAdHlwZSBib29sZWFuXG4gICAgICovXG4gICAgc3VwcG9ydC5mdW5jTmFtZXMgPSB0eXBlb2YgRnVuY3Rpb24ubmFtZSA9PSAnc3RyaW5nJztcblxuICAgIC8qKlxuICAgICAqIEJ5IGRlZmF1bHQsIHRoZSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzIHVzZWQgYnkgTG8tRGFzaCBhcmUgc2ltaWxhciB0byB0aG9zZSBpblxuICAgICAqIGVtYmVkZGVkIFJ1YnkgKEVSQikuIENoYW5nZSB0aGUgZm9sbG93aW5nIHRlbXBsYXRlIHNldHRpbmdzIHRvIHVzZSBhbHRlcm5hdGl2ZVxuICAgICAqIGRlbGltaXRlcnMuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKi9cbiAgICBsb2Rhc2gudGVtcGxhdGVTZXR0aW5ncyA9IHtcblxuICAgICAgLyoqXG4gICAgICAgKiBVc2VkIHRvIGRldGVjdCBgZGF0YWAgcHJvcGVydHkgdmFsdWVzIHRvIGJlIEhUTUwtZXNjYXBlZC5cbiAgICAgICAqXG4gICAgICAgKiBAbWVtYmVyT2YgXy50ZW1wbGF0ZVNldHRpbmdzXG4gICAgICAgKiBAdHlwZSBSZWdFeHBcbiAgICAgICAqL1xuICAgICAgJ2VzY2FwZSc6IC88JS0oW1xcc1xcU10rPyklPi9nLFxuXG4gICAgICAvKipcbiAgICAgICAqIFVzZWQgdG8gZGV0ZWN0IGNvZGUgdG8gYmUgZXZhbHVhdGVkLlxuICAgICAgICpcbiAgICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcbiAgICAgICAqIEB0eXBlIFJlZ0V4cFxuICAgICAgICovXG4gICAgICAnZXZhbHVhdGUnOiAvPCUoW1xcc1xcU10rPyklPi9nLFxuXG4gICAgICAvKipcbiAgICAgICAqIFVzZWQgdG8gZGV0ZWN0IGBkYXRhYCBwcm9wZXJ0eSB2YWx1ZXMgdG8gaW5qZWN0LlxuICAgICAgICpcbiAgICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcbiAgICAgICAqIEB0eXBlIFJlZ0V4cFxuICAgICAgICovXG4gICAgICAnaW50ZXJwb2xhdGUnOiByZUludGVycG9sYXRlLFxuXG4gICAgICAvKipcbiAgICAgICAqIFVzZWQgdG8gcmVmZXJlbmNlIHRoZSBkYXRhIG9iamVjdCBpbiB0aGUgdGVtcGxhdGUgdGV4dC5cbiAgICAgICAqXG4gICAgICAgKiBAbWVtYmVyT2YgXy50ZW1wbGF0ZVNldHRpbmdzXG4gICAgICAgKiBAdHlwZSBzdHJpbmdcbiAgICAgICAqL1xuICAgICAgJ3ZhcmlhYmxlJzogJycsXG5cbiAgICAgIC8qKlxuICAgICAgICogVXNlZCB0byBpbXBvcnQgdmFyaWFibGVzIGludG8gdGhlIGNvbXBpbGVkIHRlbXBsYXRlLlxuICAgICAgICpcbiAgICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcbiAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICovXG4gICAgICAnaW1wb3J0cyc6IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSByZWZlcmVuY2UgdG8gdGhlIGBsb2Rhc2hgIGZ1bmN0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWVtYmVyT2YgXy50ZW1wbGF0ZVNldHRpbmdzLmltcG9ydHNcbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICovXG4gICAgICAgICdfJzogbG9kYXNoXG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gICAgLyoqXG4gICAgICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8uYmluZGAgdGhhdCBjcmVhdGVzIHRoZSBib3VuZCBmdW5jdGlvbiBhbmRcbiAgICAgKiBzZXRzIGl0cyBtZXRhIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGJpbmREYXRhIFRoZSBiaW5kIGRhdGEgYXJyYXkuXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYm91bmQgZnVuY3Rpb24uXG4gICAgICovXG4gICAgZnVuY3Rpb24gYmFzZUJpbmQoYmluZERhdGEpIHtcbiAgICAgIHZhciBmdW5jID0gYmluZERhdGFbMF0sXG4gICAgICAgICAgcGFydGlhbEFyZ3MgPSBiaW5kRGF0YVsyXSxcbiAgICAgICAgICB0aGlzQXJnID0gYmluZERhdGFbNF07XG5cbiAgICAgIGZ1bmN0aW9uIGJvdW5kKCkge1xuICAgICAgICAvLyBgRnVuY3Rpb24jYmluZGAgc3BlY1xuICAgICAgICAvLyBodHRwOi8vZXM1LmdpdGh1Yi5pby8jeDE1LjMuNC41XG4gICAgICAgIGlmIChwYXJ0aWFsQXJncykge1xuICAgICAgICAgIC8vIGF2b2lkIGBhcmd1bWVudHNgIG9iamVjdCBkZW9wdGltaXphdGlvbnMgYnkgdXNpbmcgYHNsaWNlYCBpbnN0ZWFkXG4gICAgICAgICAgLy8gb2YgYEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsYCBhbmQgbm90IGFzc2lnbmluZyBgYXJndW1lbnRzYCB0byBhXG4gICAgICAgICAgLy8gdmFyaWFibGUgYXMgYSB0ZXJuYXJ5IGV4cHJlc3Npb25cbiAgICAgICAgICB2YXIgYXJncyA9IHNsaWNlKHBhcnRpYWxBcmdzKTtcbiAgICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbWltaWMgdGhlIGNvbnN0cnVjdG9yJ3MgYHJldHVybmAgYmVoYXZpb3JcbiAgICAgICAgLy8gaHR0cDovL2VzNS5naXRodWIuaW8vI3gxMy4yLjJcbiAgICAgICAgaWYgKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkge1xuICAgICAgICAgIC8vIGVuc3VyZSBgbmV3IGJvdW5kYCBpcyBhbiBpbnN0YW5jZSBvZiBgZnVuY2BcbiAgICAgICAgICB2YXIgdGhpc0JpbmRpbmcgPSBiYXNlQ3JlYXRlKGZ1bmMucHJvdG90eXBlKSxcbiAgICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQmluZGluZywgYXJncyB8fCBhcmd1bWVudHMpO1xuICAgICAgICAgIHJldHVybiBpc09iamVjdChyZXN1bHQpID8gcmVzdWx0IDogdGhpc0JpbmRpbmc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyB8fCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgICAgc2V0QmluZERhdGEoYm91bmQsIGJpbmREYXRhKTtcbiAgICAgIHJldHVybiBib3VuZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5jbG9uZWAgd2l0aG91dCBhcmd1bWVudCBqdWdnbGluZyBvciBzdXBwb3J0XG4gICAgICogZm9yIGB0aGlzQXJnYCBiaW5kaW5nLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjbG9uZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtpc0RlZXA9ZmFsc2VdIFNwZWNpZnkgYSBkZWVwIGNsb25lLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBjbG9uaW5nIHZhbHVlcy5cbiAgICAgKiBAcGFyYW0ge0FycmF5fSBbc3RhY2tBPVtdXSBUcmFja3MgdHJhdmVyc2VkIHNvdXJjZSBvYmplY3RzLlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IFtzdGFja0I9W11dIEFzc29jaWF0ZXMgY2xvbmVzIHdpdGggc291cmNlIGNvdW50ZXJwYXJ0cy5cbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgY2xvbmVkIHZhbHVlLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGJhc2VDbG9uZSh2YWx1ZSwgaXNEZWVwLCBjYWxsYmFjaywgc3RhY2tBLCBzdGFja0IpIHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gY2FsbGJhY2sodmFsdWUpO1xuICAgICAgICBpZiAodHlwZW9mIHJlc3VsdCAhPSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIGluc3BlY3QgW1tDbGFzc11dXG4gICAgICB2YXIgaXNPYmogPSBpc09iamVjdCh2YWx1ZSk7XG4gICAgICBpZiAoaXNPYmopIHtcbiAgICAgICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICAgICAgICBpZiAoIWNsb25lYWJsZUNsYXNzZXNbY2xhc3NOYW1lXSkge1xuICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY3RvciA9IGN0b3JCeUNsYXNzW2NsYXNzTmFtZV07XG4gICAgICAgIHN3aXRjaCAoY2xhc3NOYW1lKSB7XG4gICAgICAgICAgY2FzZSBib29sQ2xhc3M6XG4gICAgICAgICAgY2FzZSBkYXRlQ2xhc3M6XG4gICAgICAgICAgICByZXR1cm4gbmV3IGN0b3IoK3ZhbHVlKTtcblxuICAgICAgICAgIGNhc2UgbnVtYmVyQ2xhc3M6XG4gICAgICAgICAgY2FzZSBzdHJpbmdDbGFzczpcbiAgICAgICAgICAgIHJldHVybiBuZXcgY3Rvcih2YWx1ZSk7XG5cbiAgICAgICAgICBjYXNlIHJlZ2V4cENsYXNzOlxuICAgICAgICAgICAgcmVzdWx0ID0gY3Rvcih2YWx1ZS5zb3VyY2UsIHJlRmxhZ3MuZXhlYyh2YWx1ZSkpO1xuICAgICAgICAgICAgcmVzdWx0Lmxhc3RJbmRleCA9IHZhbHVlLmxhc3RJbmRleDtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIHZhciBpc0FyciA9IGlzQXJyYXkodmFsdWUpO1xuICAgICAgaWYgKGlzRGVlcCkge1xuICAgICAgICAvLyBjaGVjayBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlcyBhbmQgcmV0dXJuIGNvcnJlc3BvbmRpbmcgY2xvbmVcbiAgICAgICAgdmFyIGluaXRlZFN0YWNrID0gIXN0YWNrQTtcbiAgICAgICAgc3RhY2tBIHx8IChzdGFja0EgPSBnZXRBcnJheSgpKTtcbiAgICAgICAgc3RhY2tCIHx8IChzdGFja0IgPSBnZXRBcnJheSgpKTtcblxuICAgICAgICB2YXIgbGVuZ3RoID0gc3RhY2tBLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAgICAgaWYgKHN0YWNrQVtsZW5ndGhdID09IHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhY2tCW2xlbmd0aF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCA9IGlzQXJyID8gY3Rvcih2YWx1ZS5sZW5ndGgpIDoge307XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gaXNBcnIgPyBzbGljZSh2YWx1ZSkgOiBhc3NpZ24oe30sIHZhbHVlKTtcbiAgICAgIH1cbiAgICAgIC8vIGFkZCBhcnJheSBwcm9wZXJ0aWVzIGFzc2lnbmVkIGJ5IGBSZWdFeHAjZXhlY2BcbiAgICAgIGlmIChpc0Fycikge1xuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2luZGV4JykpIHtcbiAgICAgICAgICByZXN1bHQuaW5kZXggPSB2YWx1ZS5pbmRleDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2lucHV0JykpIHtcbiAgICAgICAgICByZXN1bHQuaW5wdXQgPSB2YWx1ZS5pbnB1dDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gZXhpdCBmb3Igc2hhbGxvdyBjbG9uZVxuICAgICAgaWYgKCFpc0RlZXApIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIC8vIGFkZCB0aGUgc291cmNlIHZhbHVlIHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0c1xuICAgICAgLy8gYW5kIGFzc29jaWF0ZSBpdCB3aXRoIGl0cyBjbG9uZVxuICAgICAgc3RhY2tBLnB1c2godmFsdWUpO1xuICAgICAgc3RhY2tCLnB1c2gocmVzdWx0KTtcblxuICAgICAgLy8gcmVjdXJzaXZlbHkgcG9wdWxhdGUgY2xvbmUgKHN1c2NlcHRpYmxlIHRvIGNhbGwgc3RhY2sgbGltaXRzKVxuICAgICAgKGlzQXJyID8gZm9yRWFjaCA6IGZvck93bikodmFsdWUsIGZ1bmN0aW9uKG9ialZhbHVlLCBrZXkpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSBiYXNlQ2xvbmUob2JqVmFsdWUsIGlzRGVlcCwgY2FsbGJhY2ssIHN0YWNrQSwgc3RhY2tCKTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaW5pdGVkU3RhY2spIHtcbiAgICAgICAgcmVsZWFzZUFycmF5KHN0YWNrQSk7XG4gICAgICAgIHJlbGVhc2VBcnJheShzdGFja0IpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5jcmVhdGVgIHdpdGhvdXQgc3VwcG9ydCBmb3IgYXNzaWduaW5nXG4gICAgICogcHJvcGVydGllcyB0byB0aGUgY3JlYXRlZCBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwcm90b3R5cGUgVGhlIG9iamVjdCB0byBpbmhlcml0IGZyb20uXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgbmV3IG9iamVjdC5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBiYXNlQ3JlYXRlKHByb3RvdHlwZSwgcHJvcGVydGllcykge1xuICAgICAgcmV0dXJuIGlzT2JqZWN0KHByb3RvdHlwZSkgPyBuYXRpdmVDcmVhdGUocHJvdG90eXBlKSA6IHt9O1xuICAgIH1cbiAgICAvLyBmYWxsYmFjayBmb3IgYnJvd3NlcnMgd2l0aG91dCBgT2JqZWN0LmNyZWF0ZWBcbiAgICBpZiAoIW5hdGl2ZUNyZWF0ZSkge1xuICAgICAgYmFzZUNyZWF0ZSA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgZnVuY3Rpb24gT2JqZWN0KCkge31cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHByb3RvdHlwZSkge1xuICAgICAgICAgIGlmIChpc09iamVjdChwcm90b3R5cGUpKSB7XG4gICAgICAgICAgICBPYmplY3QucHJvdG90eXBlID0gcHJvdG90eXBlO1xuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBPYmplY3Q7XG4gICAgICAgICAgICBPYmplY3QucHJvdG90eXBlID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdCB8fCBjb250ZXh0Lk9iamVjdCgpO1xuICAgICAgICB9O1xuICAgICAgfSgpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5jcmVhdGVDYWxsYmFja2Agd2l0aG91dCBzdXBwb3J0IGZvciBjcmVhdGluZ1xuICAgICAqIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrcy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHsqfSBbZnVuYz1pZGVudGl0eV0gVGhlIHZhbHVlIHRvIGNvbnZlcnQgdG8gYSBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNyZWF0ZWQgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFthcmdDb3VudF0gVGhlIG51bWJlciBvZiBhcmd1bWVudHMgdGhlIGNhbGxiYWNrIGFjY2VwdHMuXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIGEgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgICovXG4gICAgZnVuY3Rpb24gYmFzZUNyZWF0ZUNhbGxiYWNrKGZ1bmMsIHRoaXNBcmcsIGFyZ0NvdW50KSB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gaWRlbnRpdHk7XG4gICAgICB9XG4gICAgICAvLyBleGl0IGVhcmx5IGZvciBubyBgdGhpc0FyZ2Agb3IgYWxyZWFkeSBib3VuZCBieSBgRnVuY3Rpb24jYmluZGBcbiAgICAgIGlmICh0eXBlb2YgdGhpc0FyZyA9PSAndW5kZWZpbmVkJyB8fCAhKCdwcm90b3R5cGUnIGluIGZ1bmMpKSB7XG4gICAgICAgIHJldHVybiBmdW5jO1xuICAgICAgfVxuICAgICAgdmFyIGJpbmREYXRhID0gZnVuYy5fX2JpbmREYXRhX187XG4gICAgICBpZiAodHlwZW9mIGJpbmREYXRhID09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmIChzdXBwb3J0LmZ1bmNOYW1lcykge1xuICAgICAgICAgIGJpbmREYXRhID0gIWZ1bmMubmFtZTtcbiAgICAgICAgfVxuICAgICAgICBiaW5kRGF0YSA9IGJpbmREYXRhIHx8ICFzdXBwb3J0LmZ1bmNEZWNvbXA7XG4gICAgICAgIGlmICghYmluZERhdGEpIHtcbiAgICAgICAgICB2YXIgc291cmNlID0gZm5Ub1N0cmluZy5jYWxsKGZ1bmMpO1xuICAgICAgICAgIGlmICghc3VwcG9ydC5mdW5jTmFtZXMpIHtcbiAgICAgICAgICAgIGJpbmREYXRhID0gIXJlRnVuY05hbWUudGVzdChzb3VyY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWJpbmREYXRhKSB7XG4gICAgICAgICAgICAvLyBjaGVja3MgaWYgYGZ1bmNgIHJlZmVyZW5jZXMgdGhlIGB0aGlzYCBrZXl3b3JkIGFuZCBzdG9yZXMgdGhlIHJlc3VsdFxuICAgICAgICAgICAgYmluZERhdGEgPSByZVRoaXMudGVzdChzb3VyY2UpO1xuICAgICAgICAgICAgc2V0QmluZERhdGEoZnVuYywgYmluZERhdGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gZXhpdCBlYXJseSBpZiB0aGVyZSBhcmUgbm8gYHRoaXNgIHJlZmVyZW5jZXMgb3IgYGZ1bmNgIGlzIGJvdW5kXG4gICAgICBpZiAoYmluZERhdGEgPT09IGZhbHNlIHx8IChiaW5kRGF0YSAhPT0gdHJ1ZSAmJiBiaW5kRGF0YVsxXSAmIDEpKSB7XG4gICAgICAgIHJldHVybiBmdW5jO1xuICAgICAgfVxuICAgICAgc3dpdGNoIChhcmdDb3VudCkge1xuICAgICAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICBjYXNlIDI6IHJldHVybiBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhLCBiKTtcbiAgICAgICAgfTtcbiAgICAgICAgY2FzZSAzOiByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgICB9O1xuICAgICAgICBjYXNlIDQ6IHJldHVybiBmdW5jdGlvbihhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBiaW5kKGZ1bmMsIHRoaXNBcmcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBjcmVhdGVXcmFwcGVyYCB0aGF0IGNyZWF0ZXMgdGhlIHdyYXBwZXIgYW5kXG4gICAgICogc2V0cyBpdHMgbWV0YSBkYXRhLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBiaW5kRGF0YSBUaGUgYmluZCBkYXRhIGFycmF5LlxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGJhc2VDcmVhdGVXcmFwcGVyKGJpbmREYXRhKSB7XG4gICAgICB2YXIgZnVuYyA9IGJpbmREYXRhWzBdLFxuICAgICAgICAgIGJpdG1hc2sgPSBiaW5kRGF0YVsxXSxcbiAgICAgICAgICBwYXJ0aWFsQXJncyA9IGJpbmREYXRhWzJdLFxuICAgICAgICAgIHBhcnRpYWxSaWdodEFyZ3MgPSBiaW5kRGF0YVszXSxcbiAgICAgICAgICB0aGlzQXJnID0gYmluZERhdGFbNF0sXG4gICAgICAgICAgYXJpdHkgPSBiaW5kRGF0YVs1XTtcblxuICAgICAgdmFyIGlzQmluZCA9IGJpdG1hc2sgJiAxLFxuICAgICAgICAgIGlzQmluZEtleSA9IGJpdG1hc2sgJiAyLFxuICAgICAgICAgIGlzQ3VycnkgPSBiaXRtYXNrICYgNCxcbiAgICAgICAgICBpc0N1cnJ5Qm91bmQgPSBiaXRtYXNrICYgOCxcbiAgICAgICAgICBrZXkgPSBmdW5jO1xuXG4gICAgICBmdW5jdGlvbiBib3VuZCgpIHtcbiAgICAgICAgdmFyIHRoaXNCaW5kaW5nID0gaXNCaW5kID8gdGhpc0FyZyA6IHRoaXM7XG4gICAgICAgIGlmIChwYXJ0aWFsQXJncykge1xuICAgICAgICAgIHZhciBhcmdzID0gc2xpY2UocGFydGlhbEFyZ3MpO1xuICAgICAgICAgIHB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFydGlhbFJpZ2h0QXJncyB8fCBpc0N1cnJ5KSB7XG4gICAgICAgICAgYXJncyB8fCAoYXJncyA9IHNsaWNlKGFyZ3VtZW50cykpO1xuICAgICAgICAgIGlmIChwYXJ0aWFsUmlnaHRBcmdzKSB7XG4gICAgICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIHBhcnRpYWxSaWdodEFyZ3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaXNDdXJyeSAmJiBhcmdzLmxlbmd0aCA8IGFyaXR5KSB7XG4gICAgICAgICAgICBiaXRtYXNrIHw9IDE2ICYgfjMyO1xuICAgICAgICAgICAgcmV0dXJuIGJhc2VDcmVhdGVXcmFwcGVyKFtmdW5jLCAoaXNDdXJyeUJvdW5kID8gYml0bWFzayA6IGJpdG1hc2sgJiB+MyksIGFyZ3MsIG51bGwsIHRoaXNBcmcsIGFyaXR5XSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGFyZ3MgfHwgKGFyZ3MgPSBhcmd1bWVudHMpO1xuICAgICAgICBpZiAoaXNCaW5kS2V5KSB7XG4gICAgICAgICAgZnVuYyA9IHRoaXNCaW5kaW5nW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkge1xuICAgICAgICAgIHRoaXNCaW5kaW5nID0gYmFzZUNyZWF0ZShmdW5jLnByb3RvdHlwZSk7XG4gICAgICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0JpbmRpbmcsIGFyZ3MpO1xuICAgICAgICAgIHJldHVybiBpc09iamVjdChyZXN1bHQpID8gcmVzdWx0IDogdGhpc0JpbmRpbmc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc0JpbmRpbmcsIGFyZ3MpO1xuICAgICAgfVxuICAgICAgc2V0QmluZERhdGEoYm91bmQsIGJpbmREYXRhKTtcbiAgICAgIHJldHVybiBib3VuZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5kaWZmZXJlbmNlYCB0aGF0IGFjY2VwdHMgYSBzaW5nbGUgYXJyYXlcbiAgICAgKiBvZiB2YWx1ZXMgdG8gZXhjbHVkZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHByb2Nlc3MuXG4gICAgICogQHBhcmFtIHtBcnJheX0gW3ZhbHVlc10gVGhlIGFycmF5IG9mIHZhbHVlcyB0byBleGNsdWRlLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBmaWx0ZXJlZCB2YWx1ZXMuXG4gICAgICovXG4gICAgZnVuY3Rpb24gYmFzZURpZmZlcmVuY2UoYXJyYXksIHZhbHVlcykge1xuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgaW5kZXhPZiA9IGdldEluZGV4T2YoKSxcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXG4gICAgICAgICAgaXNMYXJnZSA9IGxlbmd0aCA+PSBsYXJnZUFycmF5U2l6ZSAmJiBpbmRleE9mID09PSBiYXNlSW5kZXhPZixcbiAgICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgICAgaWYgKGlzTGFyZ2UpIHtcbiAgICAgICAgdmFyIGNhY2hlID0gY3JlYXRlQ2FjaGUodmFsdWVzKTtcbiAgICAgICAgaWYgKGNhY2hlKSB7XG4gICAgICAgICAgaW5kZXhPZiA9IGNhY2hlSW5kZXhPZjtcbiAgICAgICAgICB2YWx1ZXMgPSBjYWNoZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpc0xhcmdlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2luZGV4XTtcbiAgICAgICAgaWYgKGluZGV4T2YodmFsdWVzLCB2YWx1ZSkgPCAwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaXNMYXJnZSkge1xuICAgICAgICByZWxlYXNlT2JqZWN0KHZhbHVlcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmZsYXR0ZW5gIHdpdGhvdXQgc3VwcG9ydCBmb3IgY2FsbGJhY2tcbiAgICAgKiBzaG9ydGhhbmRzIG9yIGB0aGlzQXJnYCBiaW5kaW5nLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gZmxhdHRlbi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtpc1NoYWxsb3c9ZmFsc2VdIEEgZmxhZyB0byByZXN0cmljdCBmbGF0dGVuaW5nIHRvIGEgc2luZ2xlIGxldmVsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2lzU3RyaWN0PWZhbHNlXSBBIGZsYWcgdG8gcmVzdHJpY3QgZmxhdHRlbmluZyB0byBhcnJheXMgYW5kIGBhcmd1bWVudHNgIG9iamVjdHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtmcm9tSW5kZXg9MF0gVGhlIGluZGV4IHRvIHN0YXJ0IGZyb20uXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGZsYXR0ZW5lZCBhcnJheS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBiYXNlRmxhdHRlbihhcnJheSwgaXNTaGFsbG93LCBpc1N0cmljdCwgZnJvbUluZGV4KSB7XG4gICAgICB2YXIgaW5kZXggPSAoZnJvbUluZGV4IHx8IDApIC0gMSxcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXG4gICAgICAgICAgcmVzdWx0ID0gW107XG5cbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2luZGV4XTtcblxuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnICYmIHR5cGVvZiB2YWx1ZS5sZW5ndGggPT0gJ251bWJlcidcbiAgICAgICAgICAgICYmIChpc0FycmF5KHZhbHVlKSB8fCBpc0FyZ3VtZW50cyh2YWx1ZSkpKSB7XG4gICAgICAgICAgLy8gcmVjdXJzaXZlbHkgZmxhdHRlbiBhcnJheXMgKHN1c2NlcHRpYmxlIHRvIGNhbGwgc3RhY2sgbGltaXRzKVxuICAgICAgICAgIGlmICghaXNTaGFsbG93KSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGJhc2VGbGF0dGVuKHZhbHVlLCBpc1NoYWxsb3csIGlzU3RyaWN0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIHZhbEluZGV4ID0gLTEsXG4gICAgICAgICAgICAgIHZhbExlbmd0aCA9IHZhbHVlLmxlbmd0aCxcbiAgICAgICAgICAgICAgcmVzSW5kZXggPSByZXN1bHQubGVuZ3RoO1xuXG4gICAgICAgICAgcmVzdWx0Lmxlbmd0aCArPSB2YWxMZW5ndGg7XG4gICAgICAgICAgd2hpbGUgKCsrdmFsSW5kZXggPCB2YWxMZW5ndGgpIHtcbiAgICAgICAgICAgIHJlc3VsdFtyZXNJbmRleCsrXSA9IHZhbHVlW3ZhbEluZGV4XTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIWlzU3RyaWN0KSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmlzRXF1YWxgLCB3aXRob3V0IHN1cHBvcnQgZm9yIGB0aGlzQXJnYCBiaW5kaW5nLFxuICAgICAqIHRoYXQgYWxsb3dzIHBhcnRpYWwgXCJfLndoZXJlXCIgc3R5bGUgY29tcGFyaXNvbnMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7Kn0gYSBUaGUgdmFsdWUgdG8gY29tcGFyZS5cbiAgICAgKiBAcGFyYW0geyp9IGIgVGhlIG90aGVyIHZhbHVlIHRvIGNvbXBhcmUuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gdG8gY3VzdG9taXplIGNvbXBhcmluZyB2YWx1ZXMuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2lzV2hlcmU9ZmFsc2VdIEEgZmxhZyB0byBpbmRpY2F0ZSBwZXJmb3JtaW5nIHBhcnRpYWwgY29tcGFyaXNvbnMuXG4gICAgICogQHBhcmFtIHtBcnJheX0gW3N0YWNrQT1bXV0gVHJhY2tzIHRyYXZlcnNlZCBgYWAgb2JqZWN0cy5cbiAgICAgKiBAcGFyYW0ge0FycmF5fSBbc3RhY2tCPVtdXSBUcmFja3MgdHJhdmVyc2VkIGBiYCBvYmplY3RzLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBlbHNlIGBmYWxzZWAuXG4gICAgICovXG4gICAgZnVuY3Rpb24gYmFzZUlzRXF1YWwoYSwgYiwgY2FsbGJhY2ssIGlzV2hlcmUsIHN0YWNrQSwgc3RhY2tCKSB7XG4gICAgICAvLyB1c2VkIHRvIGluZGljYXRlIHRoYXQgd2hlbiBjb21wYXJpbmcgb2JqZWN0cywgYGFgIGhhcyBhdCBsZWFzdCB0aGUgcHJvcGVydGllcyBvZiBgYmBcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gY2FsbGJhY2soYSwgYik7XG4gICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ICE9ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgcmV0dXJuICEhcmVzdWx0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBleGl0IGVhcmx5IGZvciBpZGVudGljYWwgdmFsdWVzXG4gICAgICBpZiAoYSA9PT0gYikge1xuICAgICAgICAvLyB0cmVhdCBgKzBgIHZzLiBgLTBgIGFzIG5vdCBlcXVhbFxuICAgICAgICByZXR1cm4gYSAhPT0gMCB8fCAoMSAvIGEgPT0gMSAvIGIpO1xuICAgICAgfVxuICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgYSxcbiAgICAgICAgICBvdGhlclR5cGUgPSB0eXBlb2YgYjtcblxuICAgICAgLy8gZXhpdCBlYXJseSBmb3IgdW5saWtlIHByaW1pdGl2ZSB2YWx1ZXNcbiAgICAgIGlmIChhID09PSBhICYmXG4gICAgICAgICAgIShhICYmIG9iamVjdFR5cGVzW3R5cGVdKSAmJlxuICAgICAgICAgICEoYiAmJiBvYmplY3RUeXBlc1tvdGhlclR5cGVdKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICAvLyBleGl0IGVhcmx5IGZvciBgbnVsbGAgYW5kIGB1bmRlZmluZWRgIGF2b2lkaW5nIEVTMydzIEZ1bmN0aW9uI2NhbGwgYmVoYXZpb3JcbiAgICAgIC8vIGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4MTUuMy40LjRcbiAgICAgIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBhID09PSBiO1xuICAgICAgfVxuICAgICAgLy8gY29tcGFyZSBbW0NsYXNzXV0gbmFtZXNcbiAgICAgIHZhciBjbGFzc05hbWUgPSB0b1N0cmluZy5jYWxsKGEpLFxuICAgICAgICAgIG90aGVyQ2xhc3MgPSB0b1N0cmluZy5jYWxsKGIpO1xuXG4gICAgICBpZiAoY2xhc3NOYW1lID09IGFyZ3NDbGFzcykge1xuICAgICAgICBjbGFzc05hbWUgPSBvYmplY3RDbGFzcztcbiAgICAgIH1cbiAgICAgIGlmIChvdGhlckNsYXNzID09IGFyZ3NDbGFzcykge1xuICAgICAgICBvdGhlckNsYXNzID0gb2JqZWN0Q2xhc3M7XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NOYW1lICE9IG90aGVyQ2xhc3MpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgc3dpdGNoIChjbGFzc05hbWUpIHtcbiAgICAgICAgY2FzZSBib29sQ2xhc3M6XG4gICAgICAgIGNhc2UgZGF0ZUNsYXNzOlxuICAgICAgICAgIC8vIGNvZXJjZSBkYXRlcyBhbmQgYm9vbGVhbnMgdG8gbnVtYmVycywgZGF0ZXMgdG8gbWlsbGlzZWNvbmRzIGFuZCBib29sZWFuc1xuICAgICAgICAgIC8vIHRvIGAxYCBvciBgMGAgdHJlYXRpbmcgaW52YWxpZCBkYXRlcyBjb2VyY2VkIHRvIGBOYU5gIGFzIG5vdCBlcXVhbFxuICAgICAgICAgIHJldHVybiArYSA9PSArYjtcblxuICAgICAgICBjYXNlIG51bWJlckNsYXNzOlxuICAgICAgICAgIC8vIHRyZWF0IGBOYU5gIHZzLiBgTmFOYCBhcyBlcXVhbFxuICAgICAgICAgIHJldHVybiAoYSAhPSArYSlcbiAgICAgICAgICAgID8gYiAhPSArYlxuICAgICAgICAgICAgLy8gYnV0IHRyZWF0IGArMGAgdnMuIGAtMGAgYXMgbm90IGVxdWFsXG4gICAgICAgICAgICA6IChhID09IDAgPyAoMSAvIGEgPT0gMSAvIGIpIDogYSA9PSArYik7XG5cbiAgICAgICAgY2FzZSByZWdleHBDbGFzczpcbiAgICAgICAgY2FzZSBzdHJpbmdDbGFzczpcbiAgICAgICAgICAvLyBjb2VyY2UgcmVnZXhlcyB0byBzdHJpbmdzIChodHRwOi8vZXM1LmdpdGh1Yi5pby8jeDE1LjEwLjYuNClcbiAgICAgICAgICAvLyB0cmVhdCBzdHJpbmcgcHJpbWl0aXZlcyBhbmQgdGhlaXIgY29ycmVzcG9uZGluZyBvYmplY3QgaW5zdGFuY2VzIGFzIGVxdWFsXG4gICAgICAgICAgcmV0dXJuIGEgPT0gU3RyaW5nKGIpO1xuICAgICAgfVxuICAgICAgdmFyIGlzQXJyID0gY2xhc3NOYW1lID09IGFycmF5Q2xhc3M7XG4gICAgICBpZiAoIWlzQXJyKSB7XG4gICAgICAgIC8vIHVud3JhcCBhbnkgYGxvZGFzaGAgd3JhcHBlZCB2YWx1ZXNcbiAgICAgICAgdmFyIGFXcmFwcGVkID0gaGFzT3duUHJvcGVydHkuY2FsbChhLCAnX193cmFwcGVkX18nKSxcbiAgICAgICAgICAgIGJXcmFwcGVkID0gaGFzT3duUHJvcGVydHkuY2FsbChiLCAnX193cmFwcGVkX18nKTtcblxuICAgICAgICBpZiAoYVdyYXBwZWQgfHwgYldyYXBwZWQpIHtcbiAgICAgICAgICByZXR1cm4gYmFzZUlzRXF1YWwoYVdyYXBwZWQgPyBhLl9fd3JhcHBlZF9fIDogYSwgYldyYXBwZWQgPyBiLl9fd3JhcHBlZF9fIDogYiwgY2FsbGJhY2ssIGlzV2hlcmUsIHN0YWNrQSwgc3RhY2tCKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBleGl0IGZvciBmdW5jdGlvbnMgYW5kIERPTSBub2Rlc1xuICAgICAgICBpZiAoY2xhc3NOYW1lICE9IG9iamVjdENsYXNzKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGluIG9sZGVyIHZlcnNpb25zIG9mIE9wZXJhLCBgYXJndW1lbnRzYCBvYmplY3RzIGhhdmUgYEFycmF5YCBjb25zdHJ1Y3RvcnNcbiAgICAgICAgdmFyIGN0b3JBID0gYS5jb25zdHJ1Y3RvcixcbiAgICAgICAgICAgIGN0b3JCID0gYi5jb25zdHJ1Y3RvcjtcblxuICAgICAgICAvLyBub24gYE9iamVjdGAgb2JqZWN0IGluc3RhbmNlcyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVhbFxuICAgICAgICBpZiAoY3RvckEgIT0gY3RvckIgJiZcbiAgICAgICAgICAgICAgIShpc0Z1bmN0aW9uKGN0b3JBKSAmJiBjdG9yQSBpbnN0YW5jZW9mIGN0b3JBICYmIGlzRnVuY3Rpb24oY3RvckIpICYmIGN0b3JCIGluc3RhbmNlb2YgY3RvckIpICYmXG4gICAgICAgICAgICAgICgnY29uc3RydWN0b3InIGluIGEgJiYgJ2NvbnN0cnVjdG9yJyBpbiBiKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBhc3N1bWUgY3ljbGljIHN0cnVjdHVyZXMgYXJlIGVxdWFsXG4gICAgICAvLyB0aGUgYWxnb3JpdGhtIGZvciBkZXRlY3RpbmcgY3ljbGljIHN0cnVjdHVyZXMgaXMgYWRhcHRlZCBmcm9tIEVTIDUuMVxuICAgICAgLy8gc2VjdGlvbiAxNS4xMi4zLCBhYnN0cmFjdCBvcGVyYXRpb24gYEpPYCAoaHR0cDovL2VzNS5naXRodWIuaW8vI3gxNS4xMi4zKVxuICAgICAgdmFyIGluaXRlZFN0YWNrID0gIXN0YWNrQTtcbiAgICAgIHN0YWNrQSB8fCAoc3RhY2tBID0gZ2V0QXJyYXkoKSk7XG4gICAgICBzdGFja0IgfHwgKHN0YWNrQiA9IGdldEFycmF5KCkpO1xuXG4gICAgICB2YXIgbGVuZ3RoID0gc3RhY2tBLmxlbmd0aDtcbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICBpZiAoc3RhY2tBW2xlbmd0aF0gPT0gYSkge1xuICAgICAgICAgIHJldHVybiBzdGFja0JbbGVuZ3RoXSA9PSBiO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB2YXIgc2l6ZSA9IDA7XG4gICAgICByZXN1bHQgPSB0cnVlO1xuXG4gICAgICAvLyBhZGQgYGFgIGFuZCBgYmAgdG8gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzXG4gICAgICBzdGFja0EucHVzaChhKTtcbiAgICAgIHN0YWNrQi5wdXNoKGIpO1xuXG4gICAgICAvLyByZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cyAoc3VzY2VwdGlibGUgdG8gY2FsbCBzdGFjayBsaW1pdHMpXG4gICAgICBpZiAoaXNBcnIpIHtcbiAgICAgICAgLy8gY29tcGFyZSBsZW5ndGhzIHRvIGRldGVybWluZSBpZiBhIGRlZXAgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnlcbiAgICAgICAgbGVuZ3RoID0gYS5sZW5ndGg7XG4gICAgICAgIHNpemUgPSBiLmxlbmd0aDtcbiAgICAgICAgcmVzdWx0ID0gc2l6ZSA9PSBsZW5ndGg7XG5cbiAgICAgICAgaWYgKHJlc3VsdCB8fCBpc1doZXJlKSB7XG4gICAgICAgICAgLy8gZGVlcCBjb21wYXJlIHRoZSBjb250ZW50cywgaWdub3Jpbmcgbm9uLW51bWVyaWMgcHJvcGVydGllc1xuICAgICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IGxlbmd0aCxcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGJbc2l6ZV07XG5cbiAgICAgICAgICAgIGlmIChpc1doZXJlKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChpbmRleC0tKSB7XG4gICAgICAgICAgICAgICAgaWYgKChyZXN1bHQgPSBiYXNlSXNFcXVhbChhW2luZGV4XSwgdmFsdWUsIGNhbGxiYWNrLCBpc1doZXJlLCBzdGFja0EsIHN0YWNrQikpKSB7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIShyZXN1bHQgPSBiYXNlSXNFcXVhbChhW3NpemVdLCB2YWx1ZSwgY2FsbGJhY2ssIGlzV2hlcmUsIHN0YWNrQSwgc3RhY2tCKSkpIHtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgLy8gZGVlcCBjb21wYXJlIG9iamVjdHMgdXNpbmcgYGZvckluYCwgaW5zdGVhZCBvZiBgZm9yT3duYCwgdG8gYXZvaWQgYE9iamVjdC5rZXlzYFxuICAgICAgICAvLyB3aGljaCwgaW4gdGhpcyBjYXNlLCBpcyBtb3JlIGNvc3RseVxuICAgICAgICBmb3JJbihiLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBiKSB7XG4gICAgICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoYiwga2V5KSkge1xuICAgICAgICAgICAgLy8gY291bnQgdGhlIG51bWJlciBvZiBwcm9wZXJ0aWVzLlxuICAgICAgICAgICAgc2l6ZSsrO1xuICAgICAgICAgICAgLy8gZGVlcCBjb21wYXJlIGVhY2ggcHJvcGVydHkgdmFsdWUuXG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCA9IGhhc093blByb3BlcnR5LmNhbGwoYSwga2V5KSAmJiBiYXNlSXNFcXVhbChhW2tleV0sIHZhbHVlLCBjYWxsYmFjaywgaXNXaGVyZSwgc3RhY2tBLCBzdGFja0IpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyZXN1bHQgJiYgIWlzV2hlcmUpIHtcbiAgICAgICAgICAvLyBlbnN1cmUgYm90aCBvYmplY3RzIGhhdmUgdGhlIHNhbWUgbnVtYmVyIG9mIHByb3BlcnRpZXNcbiAgICAgICAgICBmb3JJbihhLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBhKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChhLCBrZXkpKSB7XG4gICAgICAgICAgICAgIC8vIGBzaXplYCB3aWxsIGJlIGAtMWAgaWYgYGFgIGhhcyBtb3JlIHByb3BlcnRpZXMgdGhhbiBgYmBcbiAgICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgPSAtLXNpemUgPiAtMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHN0YWNrQS5wb3AoKTtcbiAgICAgIHN0YWNrQi5wb3AoKTtcblxuICAgICAgaWYgKGluaXRlZFN0YWNrKSB7XG4gICAgICAgIHJlbGVhc2VBcnJheShzdGFja0EpO1xuICAgICAgICByZWxlYXNlQXJyYXkoc3RhY2tCKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8ubWVyZ2VgIHdpdGhvdXQgYXJndW1lbnQganVnZ2xpbmcgb3Igc3VwcG9ydFxuICAgICAqIGZvciBgdGhpc0FyZ2AgYmluZGluZy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIHNvdXJjZSBvYmplY3QuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gdG8gY3VzdG9taXplIG1lcmdpbmcgcHJvcGVydGllcy5cbiAgICAgKiBAcGFyYW0ge0FycmF5fSBbc3RhY2tBPVtdXSBUcmFja3MgdHJhdmVyc2VkIHNvdXJjZSBvYmplY3RzLlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IFtzdGFja0I9W11dIEFzc29jaWF0ZXMgdmFsdWVzIHdpdGggc291cmNlIGNvdW50ZXJwYXJ0cy5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBiYXNlTWVyZ2Uob2JqZWN0LCBzb3VyY2UsIGNhbGxiYWNrLCBzdGFja0EsIHN0YWNrQikge1xuICAgICAgKGlzQXJyYXkoc291cmNlKSA/IGZvckVhY2ggOiBmb3JPd24pKHNvdXJjZSwgZnVuY3Rpb24oc291cmNlLCBrZXkpIHtcbiAgICAgICAgdmFyIGZvdW5kLFxuICAgICAgICAgICAgaXNBcnIsXG4gICAgICAgICAgICByZXN1bHQgPSBzb3VyY2UsXG4gICAgICAgICAgICB2YWx1ZSA9IG9iamVjdFtrZXldO1xuXG4gICAgICAgIGlmIChzb3VyY2UgJiYgKChpc0FyciA9IGlzQXJyYXkoc291cmNlKSkgfHwgaXNQbGFpbk9iamVjdChzb3VyY2UpKSkge1xuICAgICAgICAgIC8vIGF2b2lkIG1lcmdpbmcgcHJldmlvdXNseSBtZXJnZWQgY3ljbGljIHNvdXJjZXNcbiAgICAgICAgICB2YXIgc3RhY2tMZW5ndGggPSBzdGFja0EubGVuZ3RoO1xuICAgICAgICAgIHdoaWxlIChzdGFja0xlbmd0aC0tKSB7XG4gICAgICAgICAgICBpZiAoKGZvdW5kID0gc3RhY2tBW3N0YWNrTGVuZ3RoXSA9PSBzb3VyY2UpKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gc3RhY2tCW3N0YWNrTGVuZ3RoXTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZm91bmQpIHtcbiAgICAgICAgICAgIHZhciBpc1NoYWxsb3c7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2sodmFsdWUsIHNvdXJjZSk7XG4gICAgICAgICAgICAgIGlmICgoaXNTaGFsbG93ID0gdHlwZW9mIHJlc3VsdCAhPSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHJlc3VsdDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFpc1NoYWxsb3cpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBpc0FyclxuICAgICAgICAgICAgICAgID8gKGlzQXJyYXkodmFsdWUpID8gdmFsdWUgOiBbXSlcbiAgICAgICAgICAgICAgICA6IChpc1BsYWluT2JqZWN0KHZhbHVlKSA/IHZhbHVlIDoge30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gYWRkIGBzb3VyY2VgIGFuZCBhc3NvY2lhdGVkIGB2YWx1ZWAgdG8gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzXG4gICAgICAgICAgICBzdGFja0EucHVzaChzb3VyY2UpO1xuICAgICAgICAgICAgc3RhY2tCLnB1c2godmFsdWUpO1xuXG4gICAgICAgICAgICAvLyByZWN1cnNpdmVseSBtZXJnZSBvYmplY3RzIGFuZCBhcnJheXMgKHN1c2NlcHRpYmxlIHRvIGNhbGwgc3RhY2sgbGltaXRzKVxuICAgICAgICAgICAgaWYgKCFpc1NoYWxsb3cpIHtcbiAgICAgICAgICAgICAgYmFzZU1lcmdlKHZhbHVlLCBzb3VyY2UsIGNhbGxiYWNrLCBzdGFja0EsIHN0YWNrQik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2sodmFsdWUsIHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlc3VsdCA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICByZXN1bHQgPSBzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ICE9ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHJlc3VsdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnJhbmRvbWAgd2l0aG91dCBhcmd1bWVudCBqdWdnbGluZyBvciBzdXBwb3J0XG4gICAgICogZm9yIHJldHVybmluZyBmbG9hdGluZy1wb2ludCBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWluIFRoZSBtaW5pbXVtIHBvc3NpYmxlIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXggVGhlIG1heGltdW0gcG9zc2libGUgdmFsdWUuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBhIHJhbmRvbSBudW1iZXIuXG4gICAgICovXG4gICAgZnVuY3Rpb24gYmFzZVJhbmRvbShtaW4sIG1heCkge1xuICAgICAgcmV0dXJuIG1pbiArIGZsb29yKG5hdGl2ZVJhbmRvbSgpICogKG1heCAtIG1pbiArIDEpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy51bmlxYCB3aXRob3V0IHN1cHBvcnQgZm9yIGNhbGxiYWNrIHNob3J0aGFuZHNcbiAgICAgKiBvciBgdGhpc0FyZ2AgYmluZGluZy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHByb2Nlc3MuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbaXNTb3J0ZWQ9ZmFsc2VdIEEgZmxhZyB0byBpbmRpY2F0ZSB0aGF0IGBhcnJheWAgaXMgc29ydGVkLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIGR1cGxpY2F0ZS12YWx1ZS1mcmVlIGFycmF5LlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGJhc2VVbmlxKGFycmF5LCBpc1NvcnRlZCwgY2FsbGJhY2spIHtcbiAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgIGluZGV4T2YgPSBnZXRJbmRleE9mKCksXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxuICAgICAgICAgIHJlc3VsdCA9IFtdO1xuXG4gICAgICB2YXIgaXNMYXJnZSA9ICFpc1NvcnRlZCAmJiBsZW5ndGggPj0gbGFyZ2VBcnJheVNpemUgJiYgaW5kZXhPZiA9PT0gYmFzZUluZGV4T2YsXG4gICAgICAgICAgc2VlbiA9IChjYWxsYmFjayB8fCBpc0xhcmdlKSA/IGdldEFycmF5KCkgOiByZXN1bHQ7XG5cbiAgICAgIGlmIChpc0xhcmdlKSB7XG4gICAgICAgIHZhciBjYWNoZSA9IGNyZWF0ZUNhY2hlKHNlZW4pO1xuICAgICAgICBpbmRleE9mID0gY2FjaGVJbmRleE9mO1xuICAgICAgICBzZWVuID0gY2FjaGU7XG4gICAgICB9XG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF0sXG4gICAgICAgICAgICBjb21wdXRlZCA9IGNhbGxiYWNrID8gY2FsbGJhY2sodmFsdWUsIGluZGV4LCBhcnJheSkgOiB2YWx1ZTtcblxuICAgICAgICBpZiAoaXNTb3J0ZWRcbiAgICAgICAgICAgICAgPyAhaW5kZXggfHwgc2VlbltzZWVuLmxlbmd0aCAtIDFdICE9PSBjb21wdXRlZFxuICAgICAgICAgICAgICA6IGluZGV4T2Yoc2VlbiwgY29tcHV0ZWQpIDwgMFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgaWYgKGNhbGxiYWNrIHx8IGlzTGFyZ2UpIHtcbiAgICAgICAgICAgIHNlZW4ucHVzaChjb21wdXRlZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGlzTGFyZ2UpIHtcbiAgICAgICAgcmVsZWFzZUFycmF5KHNlZW4uYXJyYXkpO1xuICAgICAgICByZWxlYXNlT2JqZWN0KHNlZW4pO1xuICAgICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgICByZWxlYXNlQXJyYXkoc2Vlbik7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGFnZ3JlZ2F0ZXMgYSBjb2xsZWN0aW9uLCBjcmVhdGluZyBhbiBvYmplY3QgY29tcG9zZWRcbiAgICAgKiBvZiBrZXlzIGdlbmVyYXRlZCBmcm9tIHRoZSByZXN1bHRzIG9mIHJ1bm5pbmcgZWFjaCBlbGVtZW50IG9mIHRoZSBjb2xsZWN0aW9uXG4gICAgICogdGhyb3VnaCBhIGNhbGxiYWNrLiBUaGUgZ2l2ZW4gYHNldHRlcmAgZnVuY3Rpb24gc2V0cyB0aGUga2V5cyBhbmQgdmFsdWVzXG4gICAgICogb2YgdGhlIGNvbXBvc2VkIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gc2V0dGVyIFRoZSBzZXR0ZXIgZnVuY3Rpb24uXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYWdncmVnYXRvciBmdW5jdGlvbi5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBjcmVhdGVBZ2dyZWdhdG9yKHNldHRlcikge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xuXG4gICAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMDtcblxuICAgICAgICBpZiAodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJykge1xuICAgICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBjb2xsZWN0aW9uW2luZGV4XTtcbiAgICAgICAgICAgIHNldHRlcihyZXN1bHQsIHZhbHVlLCBjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pLCBjb2xsZWN0aW9uKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yT3duKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIHNldHRlcihyZXN1bHQsIHZhbHVlLCBjYWxsYmFjayh2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSwgY29sbGVjdGlvbik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCBlaXRoZXIgY3VycmllcyBvciBpbnZva2VzIGBmdW5jYFxuICAgICAqIHdpdGggYW4gb3B0aW9uYWwgYHRoaXNgIGJpbmRpbmcgYW5kIHBhcnRpYWxseSBhcHBsaWVkIGFyZ3VtZW50cy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxzdHJpbmd9IGZ1bmMgVGhlIGZ1bmN0aW9uIG9yIG1ldGhvZCBuYW1lIHRvIHJlZmVyZW5jZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYml0bWFzayBUaGUgYml0bWFzayBvZiBtZXRob2QgZmxhZ3MgdG8gY29tcG9zZS5cbiAgICAgKiAgVGhlIGJpdG1hc2sgbWF5IGJlIGNvbXBvc2VkIG9mIHRoZSBmb2xsb3dpbmcgZmxhZ3M6XG4gICAgICogIDEgLSBgXy5iaW5kYFxuICAgICAqICAyIC0gYF8uYmluZEtleWBcbiAgICAgKiAgNCAtIGBfLmN1cnJ5YFxuICAgICAqICA4IC0gYF8uY3VycnlgIChib3VuZClcbiAgICAgKiAgMTYgLSBgXy5wYXJ0aWFsYFxuICAgICAqICAzMiAtIGBfLnBhcnRpYWxSaWdodGBcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBbcGFydGlhbEFyZ3NdIEFuIGFycmF5IG9mIGFyZ3VtZW50cyB0byBwcmVwZW5kIHRvIHRob3NlXG4gICAgICogIHByb3ZpZGVkIHRvIHRoZSBuZXcgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtBcnJheX0gW3BhcnRpYWxSaWdodEFyZ3NdIEFuIGFycmF5IG9mIGFyZ3VtZW50cyB0byBhcHBlbmQgdG8gdGhvc2VcbiAgICAgKiAgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYXJpdHldIFRoZSBhcml0eSBvZiBgZnVuY2AuXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gICAgICovXG4gICAgZnVuY3Rpb24gY3JlYXRlV3JhcHBlcihmdW5jLCBiaXRtYXNrLCBwYXJ0aWFsQXJncywgcGFydGlhbFJpZ2h0QXJncywgdGhpc0FyZywgYXJpdHkpIHtcbiAgICAgIHZhciBpc0JpbmQgPSBiaXRtYXNrICYgMSxcbiAgICAgICAgICBpc0JpbmRLZXkgPSBiaXRtYXNrICYgMixcbiAgICAgICAgICBpc0N1cnJ5ID0gYml0bWFzayAmIDQsXG4gICAgICAgICAgaXNDdXJyeUJvdW5kID0gYml0bWFzayAmIDgsXG4gICAgICAgICAgaXNQYXJ0aWFsID0gYml0bWFzayAmIDE2LFxuICAgICAgICAgIGlzUGFydGlhbFJpZ2h0ID0gYml0bWFzayAmIDMyO1xuXG4gICAgICBpZiAoIWlzQmluZEtleSAmJiAhaXNGdW5jdGlvbihmdW5jKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yO1xuICAgICAgfVxuICAgICAgaWYgKGlzUGFydGlhbCAmJiAhcGFydGlhbEFyZ3MubGVuZ3RoKSB7XG4gICAgICAgIGJpdG1hc2sgJj0gfjE2O1xuICAgICAgICBpc1BhcnRpYWwgPSBwYXJ0aWFsQXJncyA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGlzUGFydGlhbFJpZ2h0ICYmICFwYXJ0aWFsUmlnaHRBcmdzLmxlbmd0aCkge1xuICAgICAgICBiaXRtYXNrICY9IH4zMjtcbiAgICAgICAgaXNQYXJ0aWFsUmlnaHQgPSBwYXJ0aWFsUmlnaHRBcmdzID0gZmFsc2U7XG4gICAgICB9XG4gICAgICB2YXIgYmluZERhdGEgPSBmdW5jICYmIGZ1bmMuX19iaW5kRGF0YV9fO1xuICAgICAgaWYgKGJpbmREYXRhICYmIGJpbmREYXRhICE9PSB0cnVlKSB7XG4gICAgICAgIC8vIGNsb25lIGBiaW5kRGF0YWBcbiAgICAgICAgYmluZERhdGEgPSBzbGljZShiaW5kRGF0YSk7XG4gICAgICAgIGlmIChiaW5kRGF0YVsyXSkge1xuICAgICAgICAgIGJpbmREYXRhWzJdID0gc2xpY2UoYmluZERhdGFbMl0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChiaW5kRGF0YVszXSkge1xuICAgICAgICAgIGJpbmREYXRhWzNdID0gc2xpY2UoYmluZERhdGFbM10pO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBgdGhpc0JpbmRpbmdgIGlzIG5vdCBwcmV2aW91c2x5IGJvdW5kXG4gICAgICAgIGlmIChpc0JpbmQgJiYgIShiaW5kRGF0YVsxXSAmIDEpKSB7XG4gICAgICAgICAgYmluZERhdGFbNF0gPSB0aGlzQXJnO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBpZiBwcmV2aW91c2x5IGJvdW5kIGJ1dCBub3QgY3VycmVudGx5IChzdWJzZXF1ZW50IGN1cnJpZWQgZnVuY3Rpb25zKVxuICAgICAgICBpZiAoIWlzQmluZCAmJiBiaW5kRGF0YVsxXSAmIDEpIHtcbiAgICAgICAgICBiaXRtYXNrIHw9IDg7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IGN1cnJpZWQgYXJpdHkgaWYgbm90IHlldCBzZXRcbiAgICAgICAgaWYgKGlzQ3VycnkgJiYgIShiaW5kRGF0YVsxXSAmIDQpKSB7XG4gICAgICAgICAgYmluZERhdGFbNV0gPSBhcml0eTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhcHBlbmQgcGFydGlhbCBsZWZ0IGFyZ3VtZW50c1xuICAgICAgICBpZiAoaXNQYXJ0aWFsKSB7XG4gICAgICAgICAgcHVzaC5hcHBseShiaW5kRGF0YVsyXSB8fCAoYmluZERhdGFbMl0gPSBbXSksIHBhcnRpYWxBcmdzKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhcHBlbmQgcGFydGlhbCByaWdodCBhcmd1bWVudHNcbiAgICAgICAgaWYgKGlzUGFydGlhbFJpZ2h0KSB7XG4gICAgICAgICAgdW5zaGlmdC5hcHBseShiaW5kRGF0YVszXSB8fCAoYmluZERhdGFbM10gPSBbXSksIHBhcnRpYWxSaWdodEFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIC8vIG1lcmdlIGZsYWdzXG4gICAgICAgIGJpbmREYXRhWzFdIHw9IGJpdG1hc2s7XG4gICAgICAgIHJldHVybiBjcmVhdGVXcmFwcGVyLmFwcGx5KG51bGwsIGJpbmREYXRhKTtcbiAgICAgIH1cbiAgICAgIC8vIGZhc3QgcGF0aCBmb3IgYF8uYmluZGBcbiAgICAgIHZhciBjcmVhdGVyID0gKGJpdG1hc2sgPT0gMSB8fCBiaXRtYXNrID09PSAxNykgPyBiYXNlQmluZCA6IGJhc2VDcmVhdGVXcmFwcGVyO1xuICAgICAgcmV0dXJuIGNyZWF0ZXIoW2Z1bmMsIGJpdG1hc2ssIHBhcnRpYWxBcmdzLCBwYXJ0aWFsUmlnaHRBcmdzLCB0aGlzQXJnLCBhcml0eV0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVzZWQgYnkgYGVzY2FwZWAgdG8gY29udmVydCBjaGFyYWN0ZXJzIHRvIEhUTUwgZW50aXRpZXMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtYXRjaCBUaGUgbWF0Y2hlZCBjaGFyYWN0ZXIgdG8gZXNjYXBlLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGVzY2FwZWQgY2hhcmFjdGVyLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGVzY2FwZUh0bWxDaGFyKG1hdGNoKSB7XG4gICAgICByZXR1cm4gaHRtbEVzY2FwZXNbbWF0Y2hdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGFwcHJvcHJpYXRlIFwiaW5kZXhPZlwiIGZ1bmN0aW9uLiBJZiB0aGUgYF8uaW5kZXhPZmAgbWV0aG9kIGlzXG4gICAgICogY3VzdG9taXplZCwgdGhpcyBtZXRob2QgcmV0dXJucyB0aGUgY3VzdG9tIG1ldGhvZCwgb3RoZXJ3aXNlIGl0IHJldHVybnNcbiAgICAgKiB0aGUgYGJhc2VJbmRleE9mYCBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBcImluZGV4T2ZcIiBmdW5jdGlvbi5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRJbmRleE9mKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IChyZXN1bHQgPSBsb2Rhc2guaW5kZXhPZikgPT09IGluZGV4T2YgPyBiYXNlSW5kZXhPZiA6IHJlc3VsdDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBuYXRpdmUgZnVuY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbiwgZWxzZSBgZmFsc2VgLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGlzTmF0aXZlKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdmdW5jdGlvbicgJiYgcmVOYXRpdmUudGVzdCh2YWx1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBgdGhpc2AgYmluZGluZyBkYXRhIG9uIGEgZ2l2ZW4gZnVuY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHNldCBkYXRhIG9uLlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IHZhbHVlIFRoZSBkYXRhIGFycmF5IHRvIHNldC5cbiAgICAgKi9cbiAgICB2YXIgc2V0QmluZERhdGEgPSAhZGVmaW5lUHJvcGVydHkgPyBub29wIDogZnVuY3Rpb24oZnVuYywgdmFsdWUpIHtcbiAgICAgIGRlc2NyaXB0b3IudmFsdWUgPSB2YWx1ZTtcbiAgICAgIGRlZmluZVByb3BlcnR5KGZ1bmMsICdfX2JpbmREYXRhX18nLCBkZXNjcmlwdG9yKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQSBmYWxsYmFjayBpbXBsZW1lbnRhdGlvbiBvZiBgaXNQbGFpbk9iamVjdGAgd2hpY2ggY2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWVcbiAgICAgKiBpcyBhbiBvYmplY3QgY3JlYXRlZCBieSB0aGUgYE9iamVjdGAgY29uc3RydWN0b3IsIGFzc3VtaW5nIG9iamVjdHMgY3JlYXRlZFxuICAgICAqIGJ5IHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3RvciBoYXZlIG5vIGluaGVyaXRlZCBlbnVtZXJhYmxlIHByb3BlcnRpZXMgYW5kIHRoYXRcbiAgICAgKiB0aGVyZSBhcmUgbm8gYE9iamVjdC5wcm90b3R5cGVgIGV4dGVuc2lvbnMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgcGxhaW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2hpbUlzUGxhaW5PYmplY3QodmFsdWUpIHtcbiAgICAgIHZhciBjdG9yLFxuICAgICAgICAgIHJlc3VsdDtcblxuICAgICAgLy8gYXZvaWQgbm9uIE9iamVjdCBvYmplY3RzLCBgYXJndW1lbnRzYCBvYmplY3RzLCBhbmQgRE9NIGVsZW1lbnRzXG4gICAgICBpZiAoISh2YWx1ZSAmJiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBvYmplY3RDbGFzcykgfHxcbiAgICAgICAgICAoY3RvciA9IHZhbHVlLmNvbnN0cnVjdG9yLCBpc0Z1bmN0aW9uKGN0b3IpICYmICEoY3RvciBpbnN0YW5jZW9mIGN0b3IpKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICAvLyBJbiBtb3N0IGVudmlyb25tZW50cyBhbiBvYmplY3QncyBvd24gcHJvcGVydGllcyBhcmUgaXRlcmF0ZWQgYmVmb3JlXG4gICAgICAvLyBpdHMgaW5oZXJpdGVkIHByb3BlcnRpZXMuIElmIHRoZSBsYXN0IGl0ZXJhdGVkIHByb3BlcnR5IGlzIGFuIG9iamVjdCdzXG4gICAgICAvLyBvd24gcHJvcGVydHkgdGhlbiB0aGVyZSBhcmUgbm8gaW5oZXJpdGVkIGVudW1lcmFibGUgcHJvcGVydGllcy5cbiAgICAgIGZvckluKHZhbHVlLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICAgIHJlc3VsdCA9IGtleTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHR5cGVvZiByZXN1bHQgPT0gJ3VuZGVmaW5lZCcgfHwgaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgcmVzdWx0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIGJ5IGB1bmVzY2FwZWAgdG8gY29udmVydCBIVE1MIGVudGl0aWVzIHRvIGNoYXJhY3RlcnMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtYXRjaCBUaGUgbWF0Y2hlZCBjaGFyYWN0ZXIgdG8gdW5lc2NhcGUuXG4gICAgICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgdW5lc2NhcGVkIGNoYXJhY3Rlci5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB1bmVzY2FwZUh0bWxDaGFyKG1hdGNoKSB7XG4gICAgICByZXR1cm4gaHRtbFVuZXNjYXBlc1ttYXRjaF07XG4gICAgfVxuXG4gICAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhbiBgYXJndW1lbnRzYCBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhbiBgYXJndW1lbnRzYCBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogKGZ1bmN0aW9uKCkgeyByZXR1cm4gXy5pc0FyZ3VtZW50cyhhcmd1bWVudHMpOyB9KSgxLCAyLCAzKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICpcbiAgICAgKiBfLmlzQXJndW1lbnRzKFsxLCAyLCAzXSk7XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc0FyZ3VtZW50cyh2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsdWUubGVuZ3RoID09ICdudW1iZXInICYmXG4gICAgICAgIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IGFyZ3NDbGFzcyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhbiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYW4gYXJyYXksIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogKGZ1bmN0aW9uKCkgeyByZXR1cm4gXy5pc0FycmF5KGFyZ3VtZW50cyk7IH0pKCk7XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKlxuICAgICAqIF8uaXNBcnJheShbMSwgMiwgM10pO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKi9cbiAgICB2YXIgaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcgJiYgdHlwZW9mIHZhbHVlLmxlbmd0aCA9PSAnbnVtYmVyJyAmJlxuICAgICAgICB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBhcnJheUNsYXNzIHx8IGZhbHNlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBIGZhbGxiYWNrIGltcGxlbWVudGF0aW9uIG9mIGBPYmplY3Qua2V5c2Agd2hpY2ggcHJvZHVjZXMgYW4gYXJyYXkgb2YgdGhlXG4gICAgICogZ2l2ZW4gb2JqZWN0J3Mgb3duIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGFuIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICAgICAqL1xuICAgIHZhciBzaGltS2V5cyA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgdmFyIGluZGV4LCBpdGVyYWJsZSA9IG9iamVjdCwgcmVzdWx0ID0gW107XG4gICAgICBpZiAoIWl0ZXJhYmxlKSByZXR1cm4gcmVzdWx0O1xuICAgICAgaWYgKCEob2JqZWN0VHlwZXNbdHlwZW9mIG9iamVjdF0pKSByZXR1cm4gcmVzdWx0O1xuICAgICAgICBmb3IgKGluZGV4IGluIGl0ZXJhYmxlKSB7XG4gICAgICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoaXRlcmFibGUsIGluZGV4KSkge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goaW5kZXgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IGNvbXBvc2VkIG9mIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBhbiBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5rZXlzKHsgJ29uZSc6IDEsICd0d28nOiAyLCAndGhyZWUnOiAzIH0pO1xuICAgICAqIC8vID0+IFsnb25lJywgJ3R3bycsICd0aHJlZSddIChwcm9wZXJ0eSBvcmRlciBpcyBub3QgZ3VhcmFudGVlZCBhY3Jvc3MgZW52aXJvbm1lbnRzKVxuICAgICAqL1xuICAgIHZhciBrZXlzID0gIW5hdGl2ZUtleXMgPyBzaGltS2V5cyA6IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgaWYgKCFpc09iamVjdChvYmplY3QpKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuYXRpdmVLZXlzKG9iamVjdCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gY29udmVydCBjaGFyYWN0ZXJzIHRvIEhUTUwgZW50aXRpZXM6XG4gICAgICpcbiAgICAgKiBUaG91Z2ggdGhlIGA+YCBjaGFyYWN0ZXIgaXMgZXNjYXBlZCBmb3Igc3ltbWV0cnksIGNoYXJhY3RlcnMgbGlrZSBgPmAgYW5kIGAvYFxuICAgICAqIGRvbid0IHJlcXVpcmUgZXNjYXBpbmcgaW4gSFRNTCBhbmQgaGF2ZSBubyBzcGVjaWFsIG1lYW5pbmcgdW5sZXNzIHRoZXkncmUgcGFydFxuICAgICAqIG9mIGEgdGFnIG9yIGFuIHVucXVvdGVkIGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICAgKiBodHRwOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9hbWJpZ3VvdXMtYW1wZXJzYW5kcyAodW5kZXIgXCJzZW1pLXJlbGF0ZWQgZnVuIGZhY3RcIilcbiAgICAgKi9cbiAgICB2YXIgaHRtbEVzY2FwZXMgPSB7XG4gICAgICAnJic6ICcmYW1wOycsXG4gICAgICAnPCc6ICcmbHQ7JyxcbiAgICAgICc+JzogJyZndDsnLFxuICAgICAgJ1wiJzogJyZxdW90OycsXG4gICAgICBcIidcIjogJyYjMzk7J1xuICAgIH07XG5cbiAgICAvKiogVXNlZCB0byBjb252ZXJ0IEhUTUwgZW50aXRpZXMgdG8gY2hhcmFjdGVycyAqL1xuICAgIHZhciBodG1sVW5lc2NhcGVzID0gaW52ZXJ0KGh0bWxFc2NhcGVzKTtcblxuICAgIC8qKiBVc2VkIHRvIG1hdGNoIEhUTUwgZW50aXRpZXMgYW5kIEhUTUwgY2hhcmFjdGVycyAqL1xuICAgIHZhciByZUVzY2FwZWRIdG1sID0gUmVnRXhwKCcoJyArIGtleXMoaHRtbFVuZXNjYXBlcykuam9pbignfCcpICsgJyknLCAnZycpLFxuICAgICAgICByZVVuZXNjYXBlZEh0bWwgPSBSZWdFeHAoJ1snICsga2V5cyhodG1sRXNjYXBlcykuam9pbignJykgKyAnXScsICdnJyk7XG5cbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbnMgb3duIGVudW1lcmFibGUgcHJvcGVydGllcyBvZiBzb3VyY2Ugb2JqZWN0KHMpIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAqIG9iamVjdC4gU3Vic2VxdWVudCBzb3VyY2VzIHdpbGwgb3ZlcndyaXRlIHByb3BlcnR5IGFzc2lnbm1lbnRzIG9mIHByZXZpb3VzXG4gICAgICogc291cmNlcy4gSWYgYSBjYWxsYmFjayBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIGV4ZWN1dGVkIHRvIHByb2R1Y2UgdGhlXG4gICAgICogYXNzaWduZWQgdmFsdWVzLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdHdvXG4gICAgICogYXJndW1lbnRzOyAob2JqZWN0VmFsdWUsIHNvdXJjZVZhbHVlKS5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAgICogQGFsaWFzIGV4dGVuZFxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7Li4uT2JqZWN0fSBbc291cmNlXSBUaGUgc291cmNlIG9iamVjdHMuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gdG8gY3VzdG9taXplIGFzc2lnbmluZyB2YWx1ZXMuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmFzc2lnbih7ICduYW1lJzogJ2ZyZWQnIH0sIHsgJ2VtcGxveWVyJzogJ3NsYXRlJyB9KTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2ZyZWQnLCAnZW1wbG95ZXInOiAnc2xhdGUnIH1cbiAgICAgKlxuICAgICAqIHZhciBkZWZhdWx0cyA9IF8ucGFydGlhbFJpZ2h0KF8uYXNzaWduLCBmdW5jdGlvbihhLCBiKSB7XG4gICAgICogICByZXR1cm4gdHlwZW9mIGEgPT0gJ3VuZGVmaW5lZCcgPyBiIDogYTtcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIHZhciBvYmplY3QgPSB7ICduYW1lJzogJ2Jhcm5leScgfTtcbiAgICAgKiBkZWZhdWx0cyhvYmplY3QsIHsgJ25hbWUnOiAnZnJlZCcsICdlbXBsb3llcic6ICdzbGF0ZScgfSk7XG4gICAgICogLy8gPT4geyAnbmFtZSc6ICdiYXJuZXknLCAnZW1wbG95ZXInOiAnc2xhdGUnIH1cbiAgICAgKi9cbiAgICB2YXIgYXNzaWduID0gZnVuY3Rpb24ob2JqZWN0LCBzb3VyY2UsIGd1YXJkKSB7XG4gICAgICB2YXIgaW5kZXgsIGl0ZXJhYmxlID0gb2JqZWN0LCByZXN1bHQgPSBpdGVyYWJsZTtcbiAgICAgIGlmICghaXRlcmFibGUpIHJldHVybiByZXN1bHQ7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgICBhcmdzSW5kZXggPSAwLFxuICAgICAgICAgIGFyZ3NMZW5ndGggPSB0eXBlb2YgZ3VhcmQgPT0gJ251bWJlcicgPyAyIDogYXJncy5sZW5ndGg7XG4gICAgICBpZiAoYXJnc0xlbmd0aCA+IDMgJiYgdHlwZW9mIGFyZ3NbYXJnc0xlbmd0aCAtIDJdID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gYmFzZUNyZWF0ZUNhbGxiYWNrKGFyZ3NbLS1hcmdzTGVuZ3RoIC0gMV0sIGFyZ3NbYXJnc0xlbmd0aC0tXSwgMik7XG4gICAgICB9IGVsc2UgaWYgKGFyZ3NMZW5ndGggPiAyICYmIHR5cGVvZiBhcmdzW2FyZ3NMZW5ndGggLSAxXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1stLWFyZ3NMZW5ndGhdO1xuICAgICAgfVxuICAgICAgd2hpbGUgKCsrYXJnc0luZGV4IDwgYXJnc0xlbmd0aCkge1xuICAgICAgICBpdGVyYWJsZSA9IGFyZ3NbYXJnc0luZGV4XTtcbiAgICAgICAgaWYgKGl0ZXJhYmxlICYmIG9iamVjdFR5cGVzW3R5cGVvZiBpdGVyYWJsZV0pIHtcbiAgICAgICAgdmFyIG93bkluZGV4ID0gLTEsXG4gICAgICAgICAgICBvd25Qcm9wcyA9IG9iamVjdFR5cGVzW3R5cGVvZiBpdGVyYWJsZV0gJiYga2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICBsZW5ndGggPSBvd25Qcm9wcyA/IG93blByb3BzLmxlbmd0aCA6IDA7XG5cbiAgICAgICAgd2hpbGUgKCsrb3duSW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICBpbmRleCA9IG93blByb3BzW293bkluZGV4XTtcbiAgICAgICAgICByZXN1bHRbaW5kZXhdID0gY2FsbGJhY2sgPyBjYWxsYmFjayhyZXN1bHRbaW5kZXhdLCBpdGVyYWJsZVtpbmRleF0pIDogaXRlcmFibGVbaW5kZXhdO1xuICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHRcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGNsb25lIG9mIGB2YWx1ZWAuIElmIGBpc0RlZXBgIGlzIGB0cnVlYCBuZXN0ZWQgb2JqZWN0cyB3aWxsIGFsc29cbiAgICAgKiBiZSBjbG9uZWQsIG90aGVyd2lzZSB0aGV5IHdpbGwgYmUgYXNzaWduZWQgYnkgcmVmZXJlbmNlLiBJZiBhIGNhbGxiYWNrXG4gICAgICogaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSBleGVjdXRlZCB0byBwcm9kdWNlIHRoZSBjbG9uZWQgdmFsdWVzLiBJZiB0aGVcbiAgICAgKiBjYWxsYmFjayByZXR1cm5zIGB1bmRlZmluZWRgIGNsb25pbmcgd2lsbCBiZSBoYW5kbGVkIGJ5IHRoZSBtZXRob2QgaW5zdGVhZC5cbiAgICAgKiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggb25lIGFyZ3VtZW50OyAodmFsdWUpLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjbG9uZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtpc0RlZXA9ZmFsc2VdIFNwZWNpZnkgYSBkZWVwIGNsb25lLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBjbG9uaW5nIHZhbHVlcy5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgY2xvbmVkIHZhbHVlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH0sXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICdhZ2UnOiA0MCB9XG4gICAgICogXTtcbiAgICAgKlxuICAgICAqIHZhciBzaGFsbG93ID0gXy5jbG9uZShjaGFyYWN0ZXJzKTtcbiAgICAgKiBzaGFsbG93WzBdID09PSBjaGFyYWN0ZXJzWzBdO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKlxuICAgICAqIHZhciBkZWVwID0gXy5jbG9uZShjaGFyYWN0ZXJzLCB0cnVlKTtcbiAgICAgKiBkZWVwWzBdID09PSBjaGFyYWN0ZXJzWzBdO1xuICAgICAqIC8vID0+IGZhbHNlXG4gICAgICpcbiAgICAgKiBfLm1peGluKHtcbiAgICAgKiAgICdjbG9uZSc6IF8ucGFydGlhbFJpZ2h0KF8uY2xvbmUsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgIHJldHVybiBfLmlzRWxlbWVudCh2YWx1ZSkgPyB2YWx1ZS5jbG9uZU5vZGUoZmFsc2UpIDogdW5kZWZpbmVkO1xuICAgICAqICAgfSlcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIHZhciBjbG9uZSA9IF8uY2xvbmUoZG9jdW1lbnQuYm9keSk7XG4gICAgICogY2xvbmUuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICogLy8gPT4gMFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGNsb25lKHZhbHVlLCBpc0RlZXAsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICAvLyBhbGxvd3Mgd29ya2luZyB3aXRoIFwiQ29sbGVjdGlvbnNcIiBtZXRob2RzIHdpdGhvdXQgdXNpbmcgdGhlaXIgYGluZGV4YFxuICAgICAgLy8gYW5kIGBjb2xsZWN0aW9uYCBhcmd1bWVudHMgZm9yIGBpc0RlZXBgIGFuZCBgY2FsbGJhY2tgXG4gICAgICBpZiAodHlwZW9mIGlzRGVlcCAhPSAnYm9vbGVhbicgJiYgaXNEZWVwICE9IG51bGwpIHtcbiAgICAgICAgdGhpc0FyZyA9IGNhbGxiYWNrO1xuICAgICAgICBjYWxsYmFjayA9IGlzRGVlcDtcbiAgICAgICAgaXNEZWVwID0gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gYmFzZUNsb25lKHZhbHVlLCBpc0RlZXAsIHR5cGVvZiBjYWxsYmFjayA9PSAnZnVuY3Rpb24nICYmIGJhc2VDcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBkZWVwIGNsb25lIG9mIGB2YWx1ZWAuIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZVxuICAgICAqIGV4ZWN1dGVkIHRvIHByb2R1Y2UgdGhlIGNsb25lZCB2YWx1ZXMuIElmIHRoZSBjYWxsYmFjayByZXR1cm5zIGB1bmRlZmluZWRgXG4gICAgICogY2xvbmluZyB3aWxsIGJlIGhhbmRsZWQgYnkgdGhlIG1ldGhvZCBpbnN0ZWFkLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG9cbiAgICAgKiBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCBvbmUgYXJndW1lbnQ7ICh2YWx1ZSkuXG4gICAgICpcbiAgICAgKiBOb3RlOiBUaGlzIG1ldGhvZCBpcyBsb29zZWx5IGJhc2VkIG9uIHRoZSBzdHJ1Y3R1cmVkIGNsb25lIGFsZ29yaXRobS4gRnVuY3Rpb25zXG4gICAgICogYW5kIERPTSBub2RlcyBhcmUgKipub3QqKiBjbG9uZWQuIFRoZSBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2YgYGFyZ3VtZW50c2Agb2JqZWN0cyBhbmRcbiAgICAgKiBvYmplY3RzIGNyZWF0ZWQgYnkgY29uc3RydWN0b3JzIG90aGVyIHRoYW4gYE9iamVjdGAgYXJlIGNsb25lZCB0byBwbGFpbiBgT2JqZWN0YCBvYmplY3RzLlxuICAgICAqIFNlZSBodHRwOi8vd3d3LnczLm9yZy9UUi9odG1sNS9pbmZyYXN0cnVjdHVyZS5odG1sI2ludGVybmFsLXN0cnVjdHVyZWQtY2xvbmluZy1hbGdvcml0aG0uXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGRlZXAgY2xvbmUuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gdG8gY3VzdG9taXplIGNsb25pbmcgdmFsdWVzLlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBkZWVwIGNsb25lZCB2YWx1ZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAgfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiB2YXIgZGVlcCA9IF8uY2xvbmVEZWVwKGNoYXJhY3RlcnMpO1xuICAgICAqIGRlZXBbMF0gPT09IGNoYXJhY3RlcnNbMF07XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKlxuICAgICAqIHZhciB2aWV3ID0ge1xuICAgICAqICAgJ2xhYmVsJzogJ2RvY3MnLFxuICAgICAqICAgJ25vZGUnOiBlbGVtZW50XG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIHZhciBjbG9uZSA9IF8uY2xvbmVEZWVwKHZpZXcsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICByZXR1cm4gXy5pc0VsZW1lbnQodmFsdWUpID8gdmFsdWUuY2xvbmVOb2RlKHRydWUpIDogdW5kZWZpbmVkO1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogY2xvbmUubm9kZSA9PSB2aWV3Lm5vZGU7XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBjbG9uZURlZXAodmFsdWUsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICByZXR1cm4gYmFzZUNsb25lKHZhbHVlLCB0cnVlLCB0eXBlb2YgY2FsbGJhY2sgPT0gJ2Z1bmN0aW9uJyAmJiBiYXNlQ3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDEpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIG9iamVjdCB0aGF0IGluaGVyaXRzIGZyb20gdGhlIGdpdmVuIGBwcm90b3R5cGVgIG9iamVjdC4gSWYgYVxuICAgICAqIGBwcm9wZXJ0aWVzYCBvYmplY3QgaXMgcHJvdmlkZWQgaXRzIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgYXJlIGFzc2lnbmVkXG4gICAgICogdG8gdGhlIGNyZWF0ZWQgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcHJvdG90eXBlIFRoZSBvYmplY3QgdG8gaW5oZXJpdCBmcm9tLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbcHJvcGVydGllc10gVGhlIHByb3BlcnRpZXMgdG8gYXNzaWduIHRvIHRoZSBvYmplY3QuXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgbmV3IG9iamVjdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogZnVuY3Rpb24gU2hhcGUoKSB7XG4gICAgICogICB0aGlzLnggPSAwO1xuICAgICAqICAgdGhpcy55ID0gMDtcbiAgICAgKiB9XG4gICAgICpcbiAgICAgKiBmdW5jdGlvbiBDaXJjbGUoKSB7XG4gICAgICogICBTaGFwZS5jYWxsKHRoaXMpO1xuICAgICAqIH1cbiAgICAgKlxuICAgICAqIENpcmNsZS5wcm90b3R5cGUgPSBfLmNyZWF0ZShTaGFwZS5wcm90b3R5cGUsIHsgJ2NvbnN0cnVjdG9yJzogQ2lyY2xlIH0pO1xuICAgICAqXG4gICAgICogdmFyIGNpcmNsZSA9IG5ldyBDaXJjbGU7XG4gICAgICogY2lyY2xlIGluc3RhbmNlb2YgQ2lyY2xlO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKlxuICAgICAqIGNpcmNsZSBpbnN0YW5jZW9mIFNoYXBlO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBjcmVhdGUocHJvdG90eXBlLCBwcm9wZXJ0aWVzKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gYmFzZUNyZWF0ZShwcm90b3R5cGUpO1xuICAgICAgcmV0dXJuIHByb3BlcnRpZXMgPyBhc3NpZ24ocmVzdWx0LCBwcm9wZXJ0aWVzKSA6IHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NpZ25zIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2Ygc291cmNlIG9iamVjdChzKSB0byB0aGUgZGVzdGluYXRpb25cbiAgICAgKiBvYmplY3QgZm9yIGFsbCBkZXN0aW5hdGlvbiBwcm9wZXJ0aWVzIHRoYXQgcmVzb2x2ZSB0byBgdW5kZWZpbmVkYC4gT25jZSBhXG4gICAgICogcHJvcGVydHkgaXMgc2V0LCBhZGRpdGlvbmFsIGRlZmF1bHRzIG9mIHRoZSBzYW1lIHByb3BlcnR5IHdpbGwgYmUgaWdub3JlZC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAgICogQHBhcmFtIHsuLi5PYmplY3R9IFtzb3VyY2VdIFRoZSBzb3VyY2Ugb2JqZWN0cy5cbiAgICAgKiBAcGFyYW0tIHtPYmplY3R9IFtndWFyZF0gQWxsb3dzIHdvcmtpbmcgd2l0aCBgXy5yZWR1Y2VgIHdpdGhvdXQgdXNpbmcgaXRzXG4gICAgICogIGBrZXlgIGFuZCBgb2JqZWN0YCBhcmd1bWVudHMgYXMgc291cmNlcy5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBvYmplY3QgPSB7ICduYW1lJzogJ2Jhcm5leScgfTtcbiAgICAgKiBfLmRlZmF1bHRzKG9iamVjdCwgeyAnbmFtZSc6ICdmcmVkJywgJ2VtcGxveWVyJzogJ3NsYXRlJyB9KTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2Jhcm5leScsICdlbXBsb3llcic6ICdzbGF0ZScgfVxuICAgICAqL1xuICAgIHZhciBkZWZhdWx0cyA9IGZ1bmN0aW9uKG9iamVjdCwgc291cmNlLCBndWFyZCkge1xuICAgICAgdmFyIGluZGV4LCBpdGVyYWJsZSA9IG9iamVjdCwgcmVzdWx0ID0gaXRlcmFibGU7XG4gICAgICBpZiAoIWl0ZXJhYmxlKSByZXR1cm4gcmVzdWx0O1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgICAgYXJnc0luZGV4ID0gMCxcbiAgICAgICAgICBhcmdzTGVuZ3RoID0gdHlwZW9mIGd1YXJkID09ICdudW1iZXInID8gMiA6IGFyZ3MubGVuZ3RoO1xuICAgICAgd2hpbGUgKCsrYXJnc0luZGV4IDwgYXJnc0xlbmd0aCkge1xuICAgICAgICBpdGVyYWJsZSA9IGFyZ3NbYXJnc0luZGV4XTtcbiAgICAgICAgaWYgKGl0ZXJhYmxlICYmIG9iamVjdFR5cGVzW3R5cGVvZiBpdGVyYWJsZV0pIHtcbiAgICAgICAgdmFyIG93bkluZGV4ID0gLTEsXG4gICAgICAgICAgICBvd25Qcm9wcyA9IG9iamVjdFR5cGVzW3R5cGVvZiBpdGVyYWJsZV0gJiYga2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICBsZW5ndGggPSBvd25Qcm9wcyA/IG93blByb3BzLmxlbmd0aCA6IDA7XG5cbiAgICAgICAgd2hpbGUgKCsrb3duSW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICBpbmRleCA9IG93blByb3BzW293bkluZGV4XTtcbiAgICAgICAgICBpZiAodHlwZW9mIHJlc3VsdFtpbmRleF0gPT0gJ3VuZGVmaW5lZCcpIHJlc3VsdFtpbmRleF0gPSBpdGVyYWJsZVtpbmRleF07XG4gICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmZpbmRJbmRleGAgZXhjZXB0IHRoYXQgaXQgcmV0dXJucyB0aGUga2V5IG9mIHRoZVxuICAgICAqIGZpcnN0IGVsZW1lbnQgdGhhdCBwYXNzZXMgdGhlIGNhbGxiYWNrIGNoZWNrLCBpbnN0ZWFkIG9mIHRoZSBlbGVtZW50IGl0c2VsZi5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gc2VhcmNoLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlclxuICAgICAqICBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIHRvXG4gICAgICogIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge3N0cmluZ3x1bmRlZmluZWR9IFJldHVybnMgdGhlIGtleSBvZiB0aGUgZm91bmQgZWxlbWVudCwgZWxzZSBgdW5kZWZpbmVkYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSB7XG4gICAgICogICAnYmFybmV5JzogeyAgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IGZhbHNlIH0sXG4gICAgICogICAnZnJlZCc6IHsgICAgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IHRydWUgfSxcbiAgICAgKiAgICdwZWJibGVzJzogeyAnYWdlJzogMSwgICdibG9ja2VkJzogZmFsc2UgfVxuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBfLmZpbmRLZXkoY2hhcmFjdGVycywgZnVuY3Rpb24oY2hyKSB7XG4gICAgICogICByZXR1cm4gY2hyLmFnZSA8IDQwO1xuICAgICAqIH0pO1xuICAgICAqIC8vID0+ICdiYXJuZXknIChwcm9wZXJ0eSBvcmRlciBpcyBub3QgZ3VhcmFudGVlZCBhY3Jvc3MgZW52aXJvbm1lbnRzKVxuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5maW5kS2V5KGNoYXJhY3RlcnMsIHsgJ2FnZSc6IDEgfSk7XG4gICAgICogLy8gPT4gJ3BlYmJsZXMnXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmZpbmRLZXkoY2hhcmFjdGVycywgJ2Jsb2NrZWQnKTtcbiAgICAgKiAvLyA9PiAnZnJlZCdcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBmaW5kS2V5KG9iamVjdCwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIHZhciByZXN1bHQ7XG4gICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XG4gICAgICBmb3JPd24ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5LCBvYmplY3QpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBrZXksIG9iamVjdCkpIHtcbiAgICAgICAgICByZXN1bHQgPSBrZXk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5maW5kS2V5YCBleGNlcHQgdGhhdCBpdCBpdGVyYXRlcyBvdmVyIGVsZW1lbnRzXG4gICAgICogb2YgYSBgY29sbGVjdGlvbmAgaW4gdGhlIG9wcG9zaXRlIG9yZGVyLlxuICAgICAqXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxuICAgICAqXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcbiAgICAgKiBlbHNlIGBmYWxzZWAuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBzZWFyY2guXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyXG4gICAgICogIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgdG9cbiAgICAgKiAgY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfHVuZGVmaW5lZH0gUmV0dXJucyB0aGUga2V5IG9mIHRoZSBmb3VuZCBlbGVtZW50LCBlbHNlIGB1bmRlZmluZWRgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IHtcbiAgICAgKiAgICdiYXJuZXknOiB7ICAnYWdlJzogMzYsICdibG9ja2VkJzogdHJ1ZSB9LFxuICAgICAqICAgJ2ZyZWQnOiB7ICAgICdhZ2UnOiA0MCwgJ2Jsb2NrZWQnOiBmYWxzZSB9LFxuICAgICAqICAgJ3BlYmJsZXMnOiB7ICdhZ2UnOiAxLCAgJ2Jsb2NrZWQnOiB0cnVlIH1cbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogXy5maW5kTGFzdEtleShjaGFyYWN0ZXJzLCBmdW5jdGlvbihjaHIpIHtcbiAgICAgKiAgIHJldHVybiBjaHIuYWdlIDwgNDA7XG4gICAgICogfSk7XG4gICAgICogLy8gPT4gcmV0dXJucyBgcGViYmxlc2AsIGFzc3VtaW5nIGBfLmZpbmRLZXlgIHJldHVybnMgYGJhcm5leWBcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy53aGVyZVwiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8uZmluZExhc3RLZXkoY2hhcmFjdGVycywgeyAnYWdlJzogNDAgfSk7XG4gICAgICogLy8gPT4gJ2ZyZWQnXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmZpbmRMYXN0S2V5KGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XG4gICAgICogLy8gPT4gJ3BlYmJsZXMnXG4gICAgICovXG4gICAgZnVuY3Rpb24gZmluZExhc3RLZXkob2JqZWN0LCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgdmFyIHJlc3VsdDtcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgIGZvck93blJpZ2h0KG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSwgb2JqZWN0KSB7XG4gICAgICAgIGlmIChjYWxsYmFjayh2YWx1ZSwga2V5LCBvYmplY3QpKSB7XG4gICAgICAgICAgcmVzdWx0ID0ga2V5O1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEl0ZXJhdGVzIG92ZXIgb3duIGFuZCBpbmhlcml0ZWQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9mIGFuIG9iamVjdCxcbiAgICAgKiBleGVjdXRpbmcgdGhlIGNhbGxiYWNrIGZvciBlYWNoIHByb3BlcnR5LiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgXG4gICAgICogYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwga2V5LCBvYmplY3QpLiBDYWxsYmFja3MgbWF5IGV4aXRcbiAgICAgKiBpdGVyYXRpb24gZWFybHkgYnkgZXhwbGljaXRseSByZXR1cm5pbmcgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaXRlcmF0ZSBvdmVyLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIGZ1bmN0aW9uIFNoYXBlKCkge1xuICAgICAqICAgdGhpcy54ID0gMDtcbiAgICAgKiAgIHRoaXMueSA9IDA7XG4gICAgICogfVxuICAgICAqXG4gICAgICogU2hhcGUucHJvdG90eXBlLm1vdmUgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgICogICB0aGlzLnggKz0geDtcbiAgICAgKiAgIHRoaXMueSArPSB5O1xuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBfLmZvckluKG5ldyBTaGFwZSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAqICAgY29uc29sZS5sb2coa2V5KTtcbiAgICAgKiB9KTtcbiAgICAgKiAvLyA9PiBsb2dzICd4JywgJ3knLCBhbmQgJ21vdmUnIChwcm9wZXJ0eSBvcmRlciBpcyBub3QgZ3VhcmFudGVlZCBhY3Jvc3MgZW52aXJvbm1lbnRzKVxuICAgICAqL1xuICAgIHZhciBmb3JJbiA9IGZ1bmN0aW9uKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgaW5kZXgsIGl0ZXJhYmxlID0gY29sbGVjdGlvbiwgcmVzdWx0ID0gaXRlcmFibGU7XG4gICAgICBpZiAoIWl0ZXJhYmxlKSByZXR1cm4gcmVzdWx0O1xuICAgICAgaWYgKCFvYmplY3RUeXBlc1t0eXBlb2YgaXRlcmFibGVdKSByZXR1cm4gcmVzdWx0O1xuICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayAmJiB0eXBlb2YgdGhpc0FyZyA9PSAndW5kZWZpbmVkJyA/IGNhbGxiYWNrIDogYmFzZUNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgICAgZm9yIChpbmRleCBpbiBpdGVyYWJsZSkge1xuICAgICAgICAgIGlmIChjYWxsYmFjayhpdGVyYWJsZVtpbmRleF0sIGluZGV4LCBjb2xsZWN0aW9uKSA9PT0gZmFsc2UpIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHRcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5mb3JJbmAgZXhjZXB0IHRoYXQgaXQgaXRlcmF0ZXMgb3ZlciBlbGVtZW50c1xuICAgICAqIG9mIGEgYGNvbGxlY3Rpb25gIGluIHRoZSBvcHBvc2l0ZSBvcmRlci5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBmdW5jdGlvbiBTaGFwZSgpIHtcbiAgICAgKiAgIHRoaXMueCA9IDA7XG4gICAgICogICB0aGlzLnkgPSAwO1xuICAgICAqIH1cbiAgICAgKlxuICAgICAqIFNoYXBlLnByb3RvdHlwZS5tb3ZlID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAqICAgdGhpcy54ICs9IHg7XG4gICAgICogICB0aGlzLnkgKz0geTtcbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogXy5mb3JJblJpZ2h0KG5ldyBTaGFwZSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAqICAgY29uc29sZS5sb2coa2V5KTtcbiAgICAgKiB9KTtcbiAgICAgKiAvLyA9PiBsb2dzICdtb3ZlJywgJ3knLCBhbmQgJ3gnIGFzc3VtaW5nIGBfLmZvckluIGAgbG9ncyAneCcsICd5JywgYW5kICdtb3ZlJ1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIGZvckluUmlnaHQob2JqZWN0LCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgdmFyIHBhaXJzID0gW107XG5cbiAgICAgIGZvckluKG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICBwYWlycy5wdXNoKGtleSwgdmFsdWUpO1xuICAgICAgfSk7XG5cbiAgICAgIHZhciBsZW5ndGggPSBwYWlycy5sZW5ndGg7XG4gICAgICBjYWxsYmFjayA9IGJhc2VDcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XG4gICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKHBhaXJzW2xlbmd0aC0tXSwgcGFpcnNbbGVuZ3RoXSwgb2JqZWN0KSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJdGVyYXRlcyBvdmVyIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2YgYW4gb2JqZWN0LCBleGVjdXRpbmcgdGhlIGNhbGxiYWNrXG4gICAgICogZm9yIGVhY2ggcHJvcGVydHkuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZVxuICAgICAqIGFyZ3VtZW50czsgKHZhbHVlLCBrZXksIG9iamVjdCkuIENhbGxiYWNrcyBtYXkgZXhpdCBpdGVyYXRpb24gZWFybHkgYnlcbiAgICAgKiBleHBsaWNpdGx5IHJldHVybmluZyBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5mb3JPd24oeyAnMCc6ICd6ZXJvJywgJzEnOiAnb25lJywgJ2xlbmd0aCc6IDIgfSwgZnVuY3Rpb24obnVtLCBrZXkpIHtcbiAgICAgKiAgIGNvbnNvbGUubG9nKGtleSk7XG4gICAgICogfSk7XG4gICAgICogLy8gPT4gbG9ncyAnMCcsICcxJywgYW5kICdsZW5ndGgnIChwcm9wZXJ0eSBvcmRlciBpcyBub3QgZ3VhcmFudGVlZCBhY3Jvc3MgZW52aXJvbm1lbnRzKVxuICAgICAqL1xuICAgIHZhciBmb3JPd24gPSBmdW5jdGlvbihjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgdmFyIGluZGV4LCBpdGVyYWJsZSA9IGNvbGxlY3Rpb24sIHJlc3VsdCA9IGl0ZXJhYmxlO1xuICAgICAgaWYgKCFpdGVyYWJsZSkgcmV0dXJuIHJlc3VsdDtcbiAgICAgIGlmICghb2JqZWN0VHlwZXNbdHlwZW9mIGl0ZXJhYmxlXSkgcmV0dXJuIHJlc3VsdDtcbiAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgJiYgdHlwZW9mIHRoaXNBcmcgPT0gJ3VuZGVmaW5lZCcgPyBjYWxsYmFjayA6IGJhc2VDcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XG4gICAgICAgIHZhciBvd25JbmRleCA9IC0xLFxuICAgICAgICAgICAgb3duUHJvcHMgPSBvYmplY3RUeXBlc1t0eXBlb2YgaXRlcmFibGVdICYmIGtleXMoaXRlcmFibGUpLFxuICAgICAgICAgICAgbGVuZ3RoID0gb3duUHJvcHMgPyBvd25Qcm9wcy5sZW5ndGggOiAwO1xuXG4gICAgICAgIHdoaWxlICgrK293bkluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgaW5kZXggPSBvd25Qcm9wc1tvd25JbmRleF07XG4gICAgICAgICAgaWYgKGNhbGxiYWNrKGl0ZXJhYmxlW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pID09PSBmYWxzZSkgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmZvck93bmAgZXhjZXB0IHRoYXQgaXQgaXRlcmF0ZXMgb3ZlciBlbGVtZW50c1xuICAgICAqIG9mIGEgYGNvbGxlY3Rpb25gIGluIHRoZSBvcHBvc2l0ZSBvcmRlci5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmZvck93blJpZ2h0KHsgJzAnOiAnemVybycsICcxJzogJ29uZScsICdsZW5ndGgnOiAyIH0sIGZ1bmN0aW9uKG51bSwga2V5KSB7XG4gICAgICogICBjb25zb2xlLmxvZyhrZXkpO1xuICAgICAqIH0pO1xuICAgICAqIC8vID0+IGxvZ3MgJ2xlbmd0aCcsICcxJywgYW5kICcwJyBhc3N1bWluZyBgXy5mb3JPd25gIGxvZ3MgJzAnLCAnMScsIGFuZCAnbGVuZ3RoJ1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIGZvck93blJpZ2h0KG9iamVjdCwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIHZhciBwcm9wcyA9IGtleXMob2JqZWN0KSxcbiAgICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGg7XG5cbiAgICAgIGNhbGxiYWNrID0gYmFzZUNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICB2YXIga2V5ID0gcHJvcHNbbGVuZ3RoXTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKG9iamVjdFtrZXldLCBrZXksIG9iamVjdCkgPT09IGZhbHNlKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNvcnRlZCBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcyBvZiBhbGwgZW51bWVyYWJsZSBwcm9wZXJ0aWVzLFxuICAgICAqIG93biBhbmQgaW5oZXJpdGVkLCBvZiBgb2JqZWN0YCB0aGF0IGhhdmUgZnVuY3Rpb24gdmFsdWVzLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGFsaWFzIG1ldGhvZHNcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcyB0aGF0IGhhdmUgZnVuY3Rpb24gdmFsdWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmZ1bmN0aW9ucyhfKTtcbiAgICAgKiAvLyA9PiBbJ2FsbCcsICdhbnknLCAnYmluZCcsICdiaW5kQWxsJywgJ2Nsb25lJywgJ2NvbXBhY3QnLCAnY29tcG9zZScsIC4uLl1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBmdW5jdGlvbnMob2JqZWN0KSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICBmb3JJbihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0LnNvcnQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgdGhlIHNwZWNpZmllZCBwcm9wZXJ0eSBuYW1lIGV4aXN0cyBhcyBhIGRpcmVjdCBwcm9wZXJ0eSBvZiBgb2JqZWN0YCxcbiAgICAgKiBpbnN0ZWFkIG9mIGFuIGluaGVyaXRlZCBwcm9wZXJ0eS5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdG8gY2hlY2suXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGtleSBpcyBhIGRpcmVjdCBwcm9wZXJ0eSwgZWxzZSBgZmFsc2VgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmhhcyh7ICdhJzogMSwgJ2InOiAyLCAnYyc6IDMgfSwgJ2InKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICovXG4gICAgZnVuY3Rpb24gaGFzKG9iamVjdCwga2V5KSB7XG4gICAgICByZXR1cm4gb2JqZWN0ID8gaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIGtleSkgOiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIG9iamVjdCBjb21wb3NlZCBvZiB0aGUgaW52ZXJ0ZWQga2V5cyBhbmQgdmFsdWVzIG9mIHRoZSBnaXZlbiBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnZlcnQuXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgY3JlYXRlZCBpbnZlcnRlZCBvYmplY3QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uaW52ZXJ0KHsgJ2ZpcnN0JzogJ2ZyZWQnLCAnc2Vjb25kJzogJ2Jhcm5leScgfSk7XG4gICAgICogLy8gPT4geyAnZnJlZCc6ICdmaXJzdCcsICdiYXJuZXknOiAnc2Vjb25kJyB9XG4gICAgICovXG4gICAgZnVuY3Rpb24gaW52ZXJ0KG9iamVjdCkge1xuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgcHJvcHMgPSBrZXlzKG9iamVjdCksXG4gICAgICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoLFxuICAgICAgICAgIHJlc3VsdCA9IHt9O1xuXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICB2YXIga2V5ID0gcHJvcHNbaW5kZXhdO1xuICAgICAgICByZXN1bHRbb2JqZWN0W2tleV1dID0ga2V5O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIGJvb2xlYW4gdmFsdWUuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIGJvb2xlYW4gdmFsdWUsIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5pc0Jvb2xlYW4obnVsbCk7XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc0Jvb2xlYW4odmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gZmFsc2UgfHxcbiAgICAgICAgdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnICYmIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IGJvb2xDbGFzcyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIGRhdGUuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIGRhdGUsIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5pc0RhdGUobmV3IERhdGUpO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc0RhdGUodmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcgJiYgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gZGF0ZUNsYXNzIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgRE9NIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIERPTSBlbGVtZW50LCBlbHNlIGBmYWxzZWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uaXNFbGVtZW50KGRvY3VtZW50LmJvZHkpO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc0VsZW1lbnQodmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZSAmJiB2YWx1ZS5ub2RlVHlwZSA9PT0gMSB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBlbXB0eS4gQXJyYXlzLCBzdHJpbmdzLCBvciBgYXJndW1lbnRzYCBvYmplY3RzIHdpdGggYVxuICAgICAqIGxlbmd0aCBvZiBgMGAgYW5kIG9iamVjdHMgd2l0aCBubyBvd24gZW51bWVyYWJsZSBwcm9wZXJ0aWVzIGFyZSBjb25zaWRlcmVkXG4gICAgICogXCJlbXB0eVwiLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IHZhbHVlIFRoZSB2YWx1ZSB0byBpbnNwZWN0LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBlbXB0eSwgZWxzZSBgZmFsc2VgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmlzRW1wdHkoWzEsIDIsIDNdKTtcbiAgICAgKiAvLyA9PiBmYWxzZVxuICAgICAqXG4gICAgICogXy5pc0VtcHR5KHt9KTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICpcbiAgICAgKiBfLmlzRW1wdHkoJycpO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc0VtcHR5KHZhbHVlKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcbiAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIHZhciBjbGFzc05hbWUgPSB0b1N0cmluZy5jYWxsKHZhbHVlKSxcbiAgICAgICAgICBsZW5ndGggPSB2YWx1ZS5sZW5ndGg7XG5cbiAgICAgIGlmICgoY2xhc3NOYW1lID09IGFycmF5Q2xhc3MgfHwgY2xhc3NOYW1lID09IHN0cmluZ0NsYXNzIHx8IGNsYXNzTmFtZSA9PSBhcmdzQ2xhc3MgKSB8fFxuICAgICAgICAgIChjbGFzc05hbWUgPT0gb2JqZWN0Q2xhc3MgJiYgdHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJyAmJiBpc0Z1bmN0aW9uKHZhbHVlLnNwbGljZSkpKSB7XG4gICAgICAgIHJldHVybiAhbGVuZ3RoO1xuICAgICAgfVxuICAgICAgZm9yT3duKHZhbHVlLCBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChyZXN1bHQgPSBmYWxzZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGVyZm9ybXMgYSBkZWVwIGNvbXBhcmlzb24gYmV0d2VlbiB0d28gdmFsdWVzIHRvIGRldGVybWluZSBpZiB0aGV5IGFyZVxuICAgICAqIGVxdWl2YWxlbnQgdG8gZWFjaCBvdGhlci4gSWYgYSBjYWxsYmFjayBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIGV4ZWN1dGVkXG4gICAgICogdG8gY29tcGFyZSB2YWx1ZXMuIElmIHRoZSBjYWxsYmFjayByZXR1cm5zIGB1bmRlZmluZWRgIGNvbXBhcmlzb25zIHdpbGxcbiAgICAgKiBiZSBoYW5kbGVkIGJ5IHRoZSBtZXRob2QgaW5zdGVhZC4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmRcbiAgICAgKiBpbnZva2VkIHdpdGggdHdvIGFyZ3VtZW50czsgKGEsIGIpLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0geyp9IGEgVGhlIHZhbHVlIHRvIGNvbXBhcmUuXG4gICAgICogQHBhcmFtIHsqfSBiIFRoZSBvdGhlciB2YWx1ZSB0byBjb21wYXJlLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBjb21wYXJpbmcgdmFsdWVzLlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBlbHNlIGBmYWxzZWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBvYmplY3QgPSB7ICduYW1lJzogJ2ZyZWQnIH07XG4gICAgICogdmFyIGNvcHkgPSB7ICduYW1lJzogJ2ZyZWQnIH07XG4gICAgICpcbiAgICAgKiBvYmplY3QgPT0gY29weTtcbiAgICAgKiAvLyA9PiBmYWxzZVxuICAgICAqXG4gICAgICogXy5pc0VxdWFsKG9iamVjdCwgY29weSk7XG4gICAgICogLy8gPT4gdHJ1ZVxuICAgICAqXG4gICAgICogdmFyIHdvcmRzID0gWydoZWxsbycsICdnb29kYnllJ107XG4gICAgICogdmFyIG90aGVyV29yZHMgPSBbJ2hpJywgJ2dvb2RieWUnXTtcbiAgICAgKlxuICAgICAqIF8uaXNFcXVhbCh3b3Jkcywgb3RoZXJXb3JkcywgZnVuY3Rpb24oYSwgYikge1xuICAgICAqICAgdmFyIHJlR3JlZXQgPSAvXig/OmhlbGxvfGhpKSQvaSxcbiAgICAgKiAgICAgICBhR3JlZXQgPSBfLmlzU3RyaW5nKGEpICYmIHJlR3JlZXQudGVzdChhKSxcbiAgICAgKiAgICAgICBiR3JlZXQgPSBfLmlzU3RyaW5nKGIpICYmIHJlR3JlZXQudGVzdChiKTtcbiAgICAgKlxuICAgICAqICAgcmV0dXJuIChhR3JlZXQgfHwgYkdyZWV0KSA/IChhR3JlZXQgPT0gYkdyZWV0KSA6IHVuZGVmaW5lZDtcbiAgICAgKiB9KTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICovXG4gICAgZnVuY3Rpb24gaXNFcXVhbChhLCBiLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgcmV0dXJuIGJhc2VJc0VxdWFsKGEsIGIsIHR5cGVvZiBjYWxsYmFjayA9PSAnZnVuY3Rpb24nICYmIGJhc2VDcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMikpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzLCBvciBjYW4gYmUgY29lcmNlZCB0bywgYSBmaW5pdGUgbnVtYmVyLlxuICAgICAqXG4gICAgICogTm90ZTogVGhpcyBpcyBub3QgdGhlIHNhbWUgYXMgbmF0aXZlIGBpc0Zpbml0ZWAgd2hpY2ggd2lsbCByZXR1cm4gdHJ1ZSBmb3JcbiAgICAgKiBib29sZWFucyBhbmQgZW1wdHkgc3RyaW5ncy4gU2VlIGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4MTUuMS4yLjUuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBmaW5pdGUsIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5pc0Zpbml0ZSgtMTAxKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICpcbiAgICAgKiBfLmlzRmluaXRlKCcxMCcpO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKlxuICAgICAqIF8uaXNGaW5pdGUodHJ1ZSk7XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKlxuICAgICAqIF8uaXNGaW5pdGUoJycpO1xuICAgICAqIC8vID0+IGZhbHNlXG4gICAgICpcbiAgICAgKiBfLmlzRmluaXRlKEluZmluaXR5KTtcbiAgICAgKiAvLyA9PiBmYWxzZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGlzRmluaXRlKHZhbHVlKSB7XG4gICAgICByZXR1cm4gbmF0aXZlSXNGaW5pdGUodmFsdWUpICYmICFuYXRpdmVJc05hTihwYXJzZUZsb2F0KHZhbHVlKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgZnVuY3Rpb24sIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5pc0Z1bmN0aW9uKF8pO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdmdW5jdGlvbic7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIGxhbmd1YWdlIHR5cGUgb2YgT2JqZWN0LlxuICAgICAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uaXNPYmplY3Qoe30pO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKlxuICAgICAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICpcbiAgICAgKiBfLmlzT2JqZWN0KDEpO1xuICAgICAqIC8vID0+IGZhbHNlXG4gICAgICovXG4gICAgZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgICAgIC8vIGNoZWNrIGlmIHRoZSB2YWx1ZSBpcyB0aGUgRUNNQVNjcmlwdCBsYW5ndWFnZSB0eXBlIG9mIE9iamVjdFxuICAgICAgLy8gaHR0cDovL2VzNS5naXRodWIuaW8vI3g4XG4gICAgICAvLyBhbmQgYXZvaWQgYSBWOCBidWdcbiAgICAgIC8vIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTFcbiAgICAgIHJldHVybiAhISh2YWx1ZSAmJiBvYmplY3RUeXBlc1t0eXBlb2YgdmFsdWVdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBgTmFOYC5cbiAgICAgKlxuICAgICAqIE5vdGU6IFRoaXMgaXMgbm90IHRoZSBzYW1lIGFzIG5hdGl2ZSBgaXNOYU5gIHdoaWNoIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3JcbiAgICAgKiBgdW5kZWZpbmVkYCBhbmQgb3RoZXIgbm9uLW51bWVyaWMgdmFsdWVzLiBTZWUgaHR0cDovL2VzNS5naXRodWIuaW8vI3gxNS4xLjIuNC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGBOYU5gLCBlbHNlIGBmYWxzZWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uaXNOYU4oTmFOKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICpcbiAgICAgKiBfLmlzTmFOKG5ldyBOdW1iZXIoTmFOKSk7XG4gICAgICogLy8gPT4gdHJ1ZVxuICAgICAqXG4gICAgICogaXNOYU4odW5kZWZpbmVkKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICpcbiAgICAgKiBfLmlzTmFOKHVuZGVmaW5lZCk7XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc05hTih2YWx1ZSkge1xuICAgICAgLy8gYE5hTmAgYXMgYSBwcmltaXRpdmUgaXMgdGhlIG9ubHkgdmFsdWUgdGhhdCBpcyBub3QgZXF1YWwgdG8gaXRzZWxmXG4gICAgICAvLyAocGVyZm9ybSB0aGUgW1tDbGFzc11dIGNoZWNrIGZpcnN0IHRvIGF2b2lkIGVycm9ycyB3aXRoIHNvbWUgaG9zdCBvYmplY3RzIGluIElFKVxuICAgICAgcmV0dXJuIGlzTnVtYmVyKHZhbHVlKSAmJiB2YWx1ZSAhPSArdmFsdWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYG51bGxgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYG51bGxgLCBlbHNlIGBmYWxzZWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uaXNOdWxsKG51bGwpO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKlxuICAgICAqIF8uaXNOdWxsKHVuZGVmaW5lZCk7XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc051bGwodmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIG51bWJlci5cbiAgICAgKlxuICAgICAqIE5vdGU6IGBOYU5gIGlzIGNvbnNpZGVyZWQgYSBudW1iZXIuIFNlZSBodHRwOi8vZXM1LmdpdGh1Yi5pby8jeDguNS5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgbnVtYmVyLCBlbHNlIGBmYWxzZWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uaXNOdW1iZXIoOC40ICogNSk7XG4gICAgICogLy8gPT4gdHJ1ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGlzTnVtYmVyKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8XG4gICAgICAgIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBudW1iZXJDbGFzcyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QgY3JlYXRlZCBieSB0aGUgYE9iamVjdGAgY29uc3RydWN0b3IuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgcGxhaW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIGZ1bmN0aW9uIFNoYXBlKCkge1xuICAgICAqICAgdGhpcy54ID0gMDtcbiAgICAgKiAgIHRoaXMueSA9IDA7XG4gICAgICogfVxuICAgICAqXG4gICAgICogXy5pc1BsYWluT2JqZWN0KG5ldyBTaGFwZSk7XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKlxuICAgICAqIF8uaXNQbGFpbk9iamVjdChbMSwgMiwgM10pO1xuICAgICAqIC8vID0+IGZhbHNlXG4gICAgICpcbiAgICAgKiBfLmlzUGxhaW5PYmplY3QoeyAneCc6IDAsICd5JzogMCB9KTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICovXG4gICAgdmFyIGlzUGxhaW5PYmplY3QgPSAhZ2V0UHJvdG90eXBlT2YgPyBzaGltSXNQbGFpbk9iamVjdCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAoISh2YWx1ZSAmJiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBvYmplY3RDbGFzcykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdmFyIHZhbHVlT2YgPSB2YWx1ZS52YWx1ZU9mLFxuICAgICAgICAgIG9ialByb3RvID0gaXNOYXRpdmUodmFsdWVPZikgJiYgKG9ialByb3RvID0gZ2V0UHJvdG90eXBlT2YodmFsdWVPZikpICYmIGdldFByb3RvdHlwZU9mKG9ialByb3RvKTtcblxuICAgICAgcmV0dXJuIG9ialByb3RvXG4gICAgICAgID8gKHZhbHVlID09IG9ialByb3RvIHx8IGdldFByb3RvdHlwZU9mKHZhbHVlKSA9PSBvYmpQcm90bylcbiAgICAgICAgOiBzaGltSXNQbGFpbk9iamVjdCh2YWx1ZSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgcmVndWxhciBleHByZXNzaW9uLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSByZWd1bGFyIGV4cHJlc3Npb24sIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5pc1JlZ0V4cCgvZnJlZC8pO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc1JlZ0V4cCh2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSByZWdleHBDbGFzcyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHN0cmluZy5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgc3RyaW5nLCBlbHNlIGBmYWxzZWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uaXNTdHJpbmcoJ2ZyZWQnKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICovXG4gICAgZnVuY3Rpb24gaXNTdHJpbmcodmFsdWUpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycgfHxcbiAgICAgICAgdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnICYmIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IHN0cmluZ0NsYXNzIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGB1bmRlZmluZWRgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYHVuZGVmaW5lZGAsIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5pc1VuZGVmaW5lZCh2b2lkIDApO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc1VuZGVmaW5lZCh2YWx1ZSkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAndW5kZWZpbmVkJztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIG9iamVjdCB3aXRoIHRoZSBzYW1lIGtleXMgYXMgYG9iamVjdGAgYW5kIHZhbHVlcyBnZW5lcmF0ZWQgYnlcbiAgICAgKiBydW5uaW5nIGVhY2ggb3duIGVudW1lcmFibGUgcHJvcGVydHkgb2YgYG9iamVjdGAgdGhyb3VnaCB0aGUgY2FsbGJhY2suXG4gICAgICogVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50cztcbiAgICAgKiAodmFsdWUsIGtleSwgb2JqZWN0KS5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaXRlcmF0ZSBvdmVyLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXG4gICAgICogIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IG9iamVjdCB3aXRoIHZhbHVlcyBvZiB0aGUgcmVzdWx0cyBvZiBlYWNoIGBjYWxsYmFja2AgZXhlY3V0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLm1hcFZhbHVlcyh7ICdhJzogMSwgJ2InOiAyLCAnYyc6IDN9ICwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gKiAzOyB9KTtcbiAgICAgKiAvLyA9PiB7ICdhJzogMywgJ2InOiA2LCAnYyc6IDkgfVxuICAgICAqXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSB7XG4gICAgICogICAnZnJlZCc6IHsgJ25hbWUnOiAnZnJlZCcsICdhZ2UnOiA0MCB9LFxuICAgICAqICAgJ3BlYmJsZXMnOiB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYWdlJzogMSB9XG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8ubWFwVmFsdWVzKGNoYXJhY3RlcnMsICdhZ2UnKTtcbiAgICAgKiAvLyA9PiB7ICdmcmVkJzogNDAsICdwZWJibGVzJzogMSB9XG4gICAgICovXG4gICAgZnVuY3Rpb24gbWFwVmFsdWVzKG9iamVjdCwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcblxuICAgICAgZm9yT3duKG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSwgb2JqZWN0KSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gY2FsbGJhY2sodmFsdWUsIGtleSwgb2JqZWN0KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWN1cnNpdmVseSBtZXJnZXMgb3duIGVudW1lcmFibGUgcHJvcGVydGllcyBvZiB0aGUgc291cmNlIG9iamVjdChzKSwgdGhhdFxuICAgICAqIGRvbid0IHJlc29sdmUgdG8gYHVuZGVmaW5lZGAgaW50byB0aGUgZGVzdGluYXRpb24gb2JqZWN0LiBTdWJzZXF1ZW50IHNvdXJjZXNcbiAgICAgKiB3aWxsIG92ZXJ3cml0ZSBwcm9wZXJ0eSBhc3NpZ25tZW50cyBvZiBwcmV2aW91cyBzb3VyY2VzLiBJZiBhIGNhbGxiYWNrIGlzXG4gICAgICogcHJvdmlkZWQgaXQgd2lsbCBiZSBleGVjdXRlZCB0byBwcm9kdWNlIHRoZSBtZXJnZWQgdmFsdWVzIG9mIHRoZSBkZXN0aW5hdGlvblxuICAgICAqIGFuZCBzb3VyY2UgcHJvcGVydGllcy4gSWYgdGhlIGNhbGxiYWNrIHJldHVybnMgYHVuZGVmaW5lZGAgbWVyZ2luZyB3aWxsXG4gICAgICogYmUgaGFuZGxlZCBieSB0aGUgbWV0aG9kIGluc3RlYWQuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kXG4gICAgICogaW52b2tlZCB3aXRoIHR3byBhcmd1bWVudHM7IChvYmplY3RWYWx1ZSwgc291cmNlVmFsdWUpLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAgICogQHBhcmFtIHsuLi5PYmplY3R9IFtzb3VyY2VdIFRoZSBzb3VyY2Ugb2JqZWN0cy5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgbWVyZ2luZyBwcm9wZXJ0aWVzLlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIG5hbWVzID0ge1xuICAgICAqICAgJ2NoYXJhY3RlcnMnOiBbXG4gICAgICogICAgIHsgJ25hbWUnOiAnYmFybmV5JyB9LFxuICAgICAqICAgICB7ICduYW1lJzogJ2ZyZWQnIH1cbiAgICAgKiAgIF1cbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogdmFyIGFnZXMgPSB7XG4gICAgICogICAnY2hhcmFjdGVycyc6IFtcbiAgICAgKiAgICAgeyAnYWdlJzogMzYgfSxcbiAgICAgKiAgICAgeyAnYWdlJzogNDAgfVxuICAgICAqICAgXVxuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBfLm1lcmdlKG5hbWVzLCBhZ2VzKTtcbiAgICAgKiAvLyA9PiB7ICdjaGFyYWN0ZXJzJzogW3sgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH0sIHsgJ25hbWUnOiAnZnJlZCcsICdhZ2UnOiA0MCB9XSB9XG4gICAgICpcbiAgICAgKiB2YXIgZm9vZCA9IHtcbiAgICAgKiAgICdmcnVpdHMnOiBbJ2FwcGxlJ10sXG4gICAgICogICAndmVnZXRhYmxlcyc6IFsnYmVldCddXG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIHZhciBvdGhlckZvb2QgPSB7XG4gICAgICogICAnZnJ1aXRzJzogWydiYW5hbmEnXSxcbiAgICAgKiAgICd2ZWdldGFibGVzJzogWydjYXJyb3QnXVxuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBfLm1lcmdlKGZvb2QsIG90aGVyRm9vZCwgZnVuY3Rpb24oYSwgYikge1xuICAgICAqICAgcmV0dXJuIF8uaXNBcnJheShhKSA/IGEuY29uY2F0KGIpIDogdW5kZWZpbmVkO1xuICAgICAqIH0pO1xuICAgICAqIC8vID0+IHsgJ2ZydWl0cyc6IFsnYXBwbGUnLCAnYmFuYW5hJ10sICd2ZWdldGFibGVzJzogWydiZWV0JywgJ2NhcnJvdF0gfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG1lcmdlKG9iamVjdCkge1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgICAgbGVuZ3RoID0gMjtcblxuICAgICAgaWYgKCFpc09iamVjdChvYmplY3QpKSB7XG4gICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgICB9XG4gICAgICAvLyBhbGxvd3Mgd29ya2luZyB3aXRoIGBfLnJlZHVjZWAgYW5kIGBfLnJlZHVjZVJpZ2h0YCB3aXRob3V0IHVzaW5nXG4gICAgICAvLyB0aGVpciBgaW5kZXhgIGFuZCBgY29sbGVjdGlvbmAgYXJndW1lbnRzXG4gICAgICBpZiAodHlwZW9mIGFyZ3NbMl0gIT0gJ251bWJlcicpIHtcbiAgICAgICAgbGVuZ3RoID0gYXJncy5sZW5ndGg7XG4gICAgICB9XG4gICAgICBpZiAobGVuZ3RoID4gMyAmJiB0eXBlb2YgYXJnc1tsZW5ndGggLSAyXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IGJhc2VDcmVhdGVDYWxsYmFjayhhcmdzWy0tbGVuZ3RoIC0gMV0sIGFyZ3NbbGVuZ3RoLS1dLCAyKTtcbiAgICAgIH0gZWxzZSBpZiAobGVuZ3RoID4gMiAmJiB0eXBlb2YgYXJnc1tsZW5ndGggLSAxXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1stLWxlbmd0aF07XG4gICAgICB9XG4gICAgICB2YXIgc291cmNlcyA9IHNsaWNlKGFyZ3VtZW50cywgMSwgbGVuZ3RoKSxcbiAgICAgICAgICBpbmRleCA9IC0xLFxuICAgICAgICAgIHN0YWNrQSA9IGdldEFycmF5KCksXG4gICAgICAgICAgc3RhY2tCID0gZ2V0QXJyYXkoKTtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgYmFzZU1lcmdlKG9iamVjdCwgc291cmNlc1tpbmRleF0sIGNhbGxiYWNrLCBzdGFja0EsIHN0YWNrQik7XG4gICAgICB9XG4gICAgICByZWxlYXNlQXJyYXkoc3RhY2tBKTtcbiAgICAgIHJlbGVhc2VBcnJheShzdGFja0IpO1xuICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2hhbGxvdyBjbG9uZSBvZiBgb2JqZWN0YCBleGNsdWRpbmcgdGhlIHNwZWNpZmllZCBwcm9wZXJ0aWVzLlxuICAgICAqIFByb3BlcnR5IG5hbWVzIG1heSBiZSBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBhcmd1bWVudHMgb3IgYXMgYXJyYXlzIG9mXG4gICAgICogcHJvcGVydHkgbmFtZXMuIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSBleGVjdXRlZCBmb3IgZWFjaFxuICAgICAqIHByb3BlcnR5IG9mIGBvYmplY3RgIG9taXR0aW5nIHRoZSBwcm9wZXJ0aWVzIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWV5XG4gICAgICogZm9yLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzO1xuICAgICAqICh2YWx1ZSwga2V5LCBvYmplY3QpLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBzb3VyY2Ugb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258Li4uc3RyaW5nfHN0cmluZ1tdfSBbY2FsbGJhY2tdIFRoZSBwcm9wZXJ0aWVzIHRvIG9taXQgb3IgdGhlXG4gICAgICogIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gb2JqZWN0IHdpdGhvdXQgdGhlIG9taXR0ZWQgcHJvcGVydGllcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5vbWl0KHsgJ25hbWUnOiAnZnJlZCcsICdhZ2UnOiA0MCB9LCAnYWdlJyk7XG4gICAgICogLy8gPT4geyAnbmFtZSc6ICdmcmVkJyB9XG4gICAgICpcbiAgICAgKiBfLm9taXQoeyAnbmFtZSc6ICdmcmVkJywgJ2FnZSc6IDQwIH0sIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInO1xuICAgICAqIH0pO1xuICAgICAqIC8vID0+IHsgJ25hbWUnOiAnZnJlZCcgfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG9taXQob2JqZWN0LCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZhciBwcm9wcyA9IFtdO1xuICAgICAgICBmb3JJbihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICBwcm9wcy5wdXNoKGtleSk7XG4gICAgICAgIH0pO1xuICAgICAgICBwcm9wcyA9IGJhc2VEaWZmZXJlbmNlKHByb3BzLCBiYXNlRmxhdHRlbihhcmd1bWVudHMsIHRydWUsIGZhbHNlLCAxKSk7XG5cbiAgICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICB2YXIga2V5ID0gcHJvcHNbaW5kZXhdO1xuICAgICAgICAgIHJlc3VsdFtrZXldID0gb2JqZWN0W2tleV07XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgICAgZm9ySW4ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5LCBvYmplY3QpIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKHZhbHVlLCBrZXksIG9iamVjdCkpIHtcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHR3byBkaW1lbnNpb25hbCBhcnJheSBvZiBhbiBvYmplY3QncyBrZXktdmFsdWUgcGFpcnMsXG4gICAgICogaS5lLiBgW1trZXkxLCB2YWx1ZTFdLCBba2V5MiwgdmFsdWUyXV1gLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgbmV3IGFycmF5IG9mIGtleS12YWx1ZSBwYWlycy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5wYWlycyh7ICdiYXJuZXknOiAzNiwgJ2ZyZWQnOiA0MCB9KTtcbiAgICAgKiAvLyA9PiBbWydiYXJuZXknLCAzNl0sIFsnZnJlZCcsIDQwXV0gKHByb3BlcnR5IG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkIGFjcm9zcyBlbnZpcm9ubWVudHMpXG4gICAgICovXG4gICAgZnVuY3Rpb24gcGFpcnMob2JqZWN0KSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBwcm9wcyA9IGtleXMob2JqZWN0KSxcbiAgICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGgsXG4gICAgICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IFtrZXksIG9iamVjdFtrZXldXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNoYWxsb3cgY2xvbmUgb2YgYG9iamVjdGAgY29tcG9zZWQgb2YgdGhlIHNwZWNpZmllZCBwcm9wZXJ0aWVzLlxuICAgICAqIFByb3BlcnR5IG5hbWVzIG1heSBiZSBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBhcmd1bWVudHMgb3IgYXMgYXJyYXlzIG9mXG4gICAgICogcHJvcGVydHkgbmFtZXMuIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSBleGVjdXRlZCBmb3IgZWFjaFxuICAgICAqIHByb3BlcnR5IG9mIGBvYmplY3RgIHBpY2tpbmcgdGhlIHByb3BlcnRpZXMgdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZXlcbiAgICAgKiBmb3IuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7XG4gICAgICogKHZhbHVlLCBrZXksIG9iamVjdCkuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIHNvdXJjZSBvYmplY3QuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnwuLi5zdHJpbmd8c3RyaW5nW119IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXJcbiAgICAgKiAgaXRlcmF0aW9uIG9yIHByb3BlcnR5IG5hbWVzIHRvIHBpY2ssIHNwZWNpZmllZCBhcyBpbmRpdmlkdWFsIHByb3BlcnR5XG4gICAgICogIG5hbWVzIG9yIGFycmF5cyBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGFuIG9iamVjdCBjb21wb3NlZCBvZiB0aGUgcGlja2VkIHByb3BlcnRpZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8ucGljayh7ICduYW1lJzogJ2ZyZWQnLCAnX3VzZXJpZCc6ICdmcmVkMScgfSwgJ25hbWUnKTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2ZyZWQnIH1cbiAgICAgKlxuICAgICAqIF8ucGljayh7ICduYW1lJzogJ2ZyZWQnLCAnX3VzZXJpZCc6ICdmcmVkMScgfSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAqICAgcmV0dXJuIGtleS5jaGFyQXQoMCkgIT0gJ18nO1xuICAgICAqIH0pO1xuICAgICAqIC8vID0+IHsgJ25hbWUnOiAnZnJlZCcgfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHBpY2sob2JqZWN0LCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgICAgcHJvcHMgPSBiYXNlRmxhdHRlbihhcmd1bWVudHMsIHRydWUsIGZhbHNlLCAxKSxcbiAgICAgICAgICAgIGxlbmd0aCA9IGlzT2JqZWN0KG9iamVjdCkgPyBwcm9wcy5sZW5ndGggOiAwO1xuXG4gICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcbiAgICAgICAgICBpZiAoa2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBvYmplY3Rba2V5XTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgICAgZm9ySW4ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5LCBvYmplY3QpIHtcbiAgICAgICAgICBpZiAoY2FsbGJhY2sodmFsdWUsIGtleSwgb2JqZWN0KSkge1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhbHRlcm5hdGl2ZSB0byBgXy5yZWR1Y2VgIHRoaXMgbWV0aG9kIHRyYW5zZm9ybXMgYG9iamVjdGAgdG8gYSBuZXdcbiAgICAgKiBgYWNjdW11bGF0b3JgIG9iamVjdCB3aGljaCBpcyB0aGUgcmVzdWx0IG9mIHJ1bm5pbmcgZWFjaCBvZiBpdHMgb3duXG4gICAgICogZW51bWVyYWJsZSBwcm9wZXJ0aWVzIHRocm91Z2ggYSBjYWxsYmFjaywgd2l0aCBlYWNoIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIHBvdGVudGlhbGx5IG11dGF0aW5nIHRoZSBgYWNjdW11bGF0b3JgIG9iamVjdC4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvXG4gICAgICogYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggZm91ciBhcmd1bWVudHM7IChhY2N1bXVsYXRvciwgdmFsdWUsIGtleSwgb2JqZWN0KS5cbiAgICAgKiBDYWxsYmFja3MgbWF5IGV4aXQgaXRlcmF0aW9uIGVhcmx5IGJ5IGV4cGxpY2l0bHkgcmV0dXJuaW5nIGBmYWxzZWAuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAgICogQHBhcmFtIHsqfSBbYWNjdW11bGF0b3JdIFRoZSBjdXN0b20gYWNjdW11bGF0b3IgdmFsdWUuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGFjY3VtdWxhdGVkIHZhbHVlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgc3F1YXJlcyA9IF8udHJhbnNmb3JtKFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMF0sIGZ1bmN0aW9uKHJlc3VsdCwgbnVtKSB7XG4gICAgICogICBudW0gKj0gbnVtO1xuICAgICAqICAgaWYgKG51bSAlIDIpIHtcbiAgICAgKiAgICAgcmV0dXJuIHJlc3VsdC5wdXNoKG51bSkgPCAzO1xuICAgICAqICAgfVxuICAgICAqIH0pO1xuICAgICAqIC8vID0+IFsxLCA5LCAyNV1cbiAgICAgKlxuICAgICAqIHZhciBtYXBwZWQgPSBfLnRyYW5zZm9ybSh7ICdhJzogMSwgJ2InOiAyLCAnYyc6IDMgfSwgZnVuY3Rpb24ocmVzdWx0LCBudW0sIGtleSkge1xuICAgICAqICAgcmVzdWx0W2tleV0gPSBudW0gKiAzO1xuICAgICAqIH0pO1xuICAgICAqIC8vID0+IHsgJ2EnOiAzLCAnYic6IDYsICdjJzogOSB9XG4gICAgICovXG4gICAgZnVuY3Rpb24gdHJhbnNmb3JtKG9iamVjdCwgY2FsbGJhY2ssIGFjY3VtdWxhdG9yLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgaXNBcnIgPSBpc0FycmF5KG9iamVjdCk7XG4gICAgICBpZiAoYWNjdW11bGF0b3IgPT0gbnVsbCkge1xuICAgICAgICBpZiAoaXNBcnIpIHtcbiAgICAgICAgICBhY2N1bXVsYXRvciA9IFtdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBjdG9yID0gb2JqZWN0ICYmIG9iamVjdC5jb25zdHJ1Y3RvcixcbiAgICAgICAgICAgICAgcHJvdG8gPSBjdG9yICYmIGN0b3IucHJvdG90eXBlO1xuXG4gICAgICAgICAgYWNjdW11bGF0b3IgPSBiYXNlQ3JlYXRlKHByb3RvKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCA0KTtcbiAgICAgICAgKGlzQXJyID8gZm9yRWFjaCA6IGZvck93bikob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIG9iamVjdCkge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBvYmplY3QpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhY2N1bXVsYXRvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IGNvbXBvc2VkIG9mIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSB2YWx1ZXMgb2YgYG9iamVjdGAuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiBwcm9wZXJ0eSB2YWx1ZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8udmFsdWVzKHsgJ29uZSc6IDEsICd0d28nOiAyLCAndGhyZWUnOiAzIH0pO1xuICAgICAqIC8vID0+IFsxLCAyLCAzXSAocHJvcGVydHkgb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQgYWNyb3NzIGVudmlyb25tZW50cylcbiAgICAgKi9cbiAgICBmdW5jdGlvbiB2YWx1ZXMob2JqZWN0KSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBwcm9wcyA9IGtleXMob2JqZWN0KSxcbiAgICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGgsXG4gICAgICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IG9iamVjdFtwcm9wc1tpbmRleF1dO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgZWxlbWVudHMgZnJvbSB0aGUgc3BlY2lmaWVkIGluZGV4ZXMsIG9yIGtleXMsIG9mIHRoZVxuICAgICAqIGBjb2xsZWN0aW9uYC4gSW5kZXhlcyBtYXkgYmUgc3BlY2lmaWVkIGFzIGluZGl2aWR1YWwgYXJndW1lbnRzIG9yIGFzIGFycmF5c1xuICAgICAqIG9mIGluZGV4ZXMuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgICAqIEBwYXJhbSB7Li4uKG51bWJlcnxudW1iZXJbXXxzdHJpbmd8c3RyaW5nW10pfSBbaW5kZXhdIFRoZSBpbmRleGVzIG9mIGBjb2xsZWN0aW9uYFxuICAgICAqICAgdG8gcmV0cmlldmUsIHNwZWNpZmllZCBhcyBpbmRpdmlkdWFsIGluZGV4ZXMgb3IgYXJyYXlzIG9mIGluZGV4ZXMuXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGVsZW1lbnRzIGNvcnJlc3BvbmRpbmcgdG8gdGhlXG4gICAgICogIHByb3ZpZGVkIGluZGV4ZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uYXQoWydhJywgJ2InLCAnYycsICdkJywgJ2UnXSwgWzAsIDIsIDRdKTtcbiAgICAgKiAvLyA9PiBbJ2EnLCAnYycsICdlJ11cbiAgICAgKlxuICAgICAqIF8uYXQoWydmcmVkJywgJ2Jhcm5leScsICdwZWJibGVzJ10sIDAsIDIpO1xuICAgICAqIC8vID0+IFsnZnJlZCcsICdwZWJibGVzJ11cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBhdChjb2xsZWN0aW9uKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgICBpbmRleCA9IC0xLFxuICAgICAgICAgIHByb3BzID0gYmFzZUZsYXR0ZW4oYXJncywgdHJ1ZSwgZmFsc2UsIDEpLFxuICAgICAgICAgIGxlbmd0aCA9IChhcmdzWzJdICYmIGFyZ3NbMl1bYXJnc1sxXV0gPT09IGNvbGxlY3Rpb24pID8gMSA6IHByb3BzLmxlbmd0aCxcbiAgICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgICB3aGlsZSgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBjb2xsZWN0aW9uW3Byb3BzW2luZGV4XV07XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBhIGdpdmVuIHZhbHVlIGlzIHByZXNlbnQgaW4gYSBjb2xsZWN0aW9uIHVzaW5nIHN0cmljdCBlcXVhbGl0eVxuICAgICAqIGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgYGZyb21JbmRleGAgaXMgbmVnYXRpdmUsIGl0IGlzIHVzZWQgYXMgdGhlXG4gICAgICogb2Zmc2V0IGZyb20gdGhlIGVuZCBvZiB0aGUgY29sbGVjdGlvbi5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBhbGlhcyBpbmNsdWRlXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0geyp9IHRhcmdldCBUaGUgdmFsdWUgdG8gY2hlY2sgZm9yLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZnJvbUluZGV4PTBdIFRoZSBpbmRleCB0byBzZWFyY2ggZnJvbS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB0YXJnZXRgIGVsZW1lbnQgaXMgZm91bmQsIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5jb250YWlucyhbMSwgMiwgM10sIDEpO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKlxuICAgICAqIF8uY29udGFpbnMoWzEsIDIsIDNdLCAxLCAyKTtcbiAgICAgKiAvLyA9PiBmYWxzZVxuICAgICAqXG4gICAgICogXy5jb250YWlucyh7ICduYW1lJzogJ2ZyZWQnLCAnYWdlJzogNDAgfSwgJ2ZyZWQnKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICpcbiAgICAgKiBfLmNvbnRhaW5zKCdwZWJibGVzJywgJ2ViJyk7XG4gICAgICogLy8gPT4gdHJ1ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGNvbnRhaW5zKGNvbGxlY3Rpb24sIHRhcmdldCwgZnJvbUluZGV4KSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBpbmRleE9mID0gZ2V0SW5kZXhPZigpLFxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXG4gICAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG5cbiAgICAgIGZyb21JbmRleCA9IChmcm9tSW5kZXggPCAwID8gbmF0aXZlTWF4KDAsIGxlbmd0aCArIGZyb21JbmRleCkgOiBmcm9tSW5kZXgpIHx8IDA7XG4gICAgICBpZiAoaXNBcnJheShjb2xsZWN0aW9uKSkge1xuICAgICAgICByZXN1bHQgPSBpbmRleE9mKGNvbGxlY3Rpb24sIHRhcmdldCwgZnJvbUluZGV4KSA+IC0xO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICAgIHJlc3VsdCA9IChpc1N0cmluZyhjb2xsZWN0aW9uKSA/IGNvbGxlY3Rpb24uaW5kZXhPZih0YXJnZXQsIGZyb21JbmRleCkgOiBpbmRleE9mKGNvbGxlY3Rpb24sIHRhcmdldCwgZnJvbUluZGV4KSkgPiAtMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvck93bihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgIGlmICgrK2luZGV4ID49IGZyb21JbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuICEocmVzdWx0ID0gdmFsdWUgPT09IHRhcmdldCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBvYmplY3QgY29tcG9zZWQgb2Yga2V5cyBnZW5lcmF0ZWQgZnJvbSB0aGUgcmVzdWx0cyBvZiBydW5uaW5nXG4gICAgICogZWFjaCBlbGVtZW50IG9mIGBjb2xsZWN0aW9uYCB0aHJvdWdoIHRoZSBjYWxsYmFjay4gVGhlIGNvcnJlc3BvbmRpbmcgdmFsdWVcbiAgICAgKiBvZiBlYWNoIGtleSBpcyB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoZSBrZXkgd2FzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFjay5cbiAgICAgKiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzO1xuICAgICAqICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgICAqICBwZXIgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZFxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGNvbXBvc2VkIGFnZ3JlZ2F0ZSBvYmplY3QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uY291bnRCeShbNC4zLCA2LjEsIDYuNF0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gTWF0aC5mbG9vcihudW0pOyB9KTtcbiAgICAgKiAvLyA9PiB7ICc0JzogMSwgJzYnOiAyIH1cbiAgICAgKlxuICAgICAqIF8uY291bnRCeShbNC4zLCA2LjEsIDYuNF0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gdGhpcy5mbG9vcihudW0pOyB9LCBNYXRoKTtcbiAgICAgKiAvLyA9PiB7ICc0JzogMSwgJzYnOiAyIH1cbiAgICAgKlxuICAgICAqIF8uY291bnRCeShbJ29uZScsICd0d28nLCAndGhyZWUnXSwgJ2xlbmd0aCcpO1xuICAgICAqIC8vID0+IHsgJzMnOiAyLCAnNSc6IDEgfVxuICAgICAqL1xuICAgIHZhciBjb3VudEJ5ID0gY3JlYXRlQWdncmVnYXRvcihmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICAgIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHJlc3VsdCwga2V5KSA/IHJlc3VsdFtrZXldKysgOiByZXN1bHRba2V5XSA9IDEpO1xuICAgIH0pO1xuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIHRoZSBnaXZlbiBjYWxsYmFjayByZXR1cm5zIHRydWV5IHZhbHVlIGZvciAqKmFsbCoqIGVsZW1lbnRzIG9mXG4gICAgICogYSBjb2xsZWN0aW9uLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcbiAgICAgKiBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGFsaWFzIGFsbFxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYWxsIGVsZW1lbnRzIHBhc3NlZCB0aGUgY2FsbGJhY2sgY2hlY2ssXG4gICAgICogIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5ldmVyeShbdHJ1ZSwgMSwgbnVsbCwgJ3llcyddKTtcbiAgICAgKiAvLyA9PiBmYWxzZVxuICAgICAqXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAgfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmV2ZXJ5KGNoYXJhY3RlcnMsICdhZ2UnKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmV2ZXJ5KGNoYXJhY3RlcnMsIHsgJ2FnZSc6IDM2IH0pO1xuICAgICAqIC8vID0+IGZhbHNlXG4gICAgICovXG4gICAgZnVuY3Rpb24gZXZlcnkoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIHZhciByZXN1bHQgPSB0cnVlO1xuICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xuXG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xuXG4gICAgICBpZiAodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJykge1xuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9ICEhY2FsbGJhY2soY29sbGVjdGlvbltpbmRleF0sIGluZGV4LCBjb2xsZWN0aW9uKSkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yT3duKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICAgIHJldHVybiAocmVzdWx0ID0gISFjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEl0ZXJhdGVzIG92ZXIgZWxlbWVudHMgb2YgYSBjb2xsZWN0aW9uLCByZXR1cm5pbmcgYW4gYXJyYXkgb2YgYWxsIGVsZW1lbnRzXG4gICAgICogdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZXkgZm9yLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZFxuICAgICAqIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGFsaWFzIHNlbGVjdFxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgdGhhdCBwYXNzZWQgdGhlIGNhbGxiYWNrIGNoZWNrLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgZXZlbnMgPSBfLmZpbHRlcihbMSwgMiwgMywgNCwgNSwgNl0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtICUgMiA9PSAwOyB9KTtcbiAgICAgKiAvLyA9PiBbMiwgNCwgNl1cbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYsICdibG9ja2VkJzogZmFsc2UgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IHRydWUgfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmZpbHRlcihjaGFyYWN0ZXJzLCAnYmxvY2tlZCcpO1xuICAgICAqIC8vID0+IFt7ICduYW1lJzogJ2ZyZWQnLCAnYWdlJzogNDAsICdibG9ja2VkJzogdHJ1ZSB9XVxuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5maWx0ZXIoY2hhcmFjdGVycywgeyAnYWdlJzogMzYgfSk7XG4gICAgICogLy8gPT4gW3sgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IGZhbHNlIH1dXG4gICAgICovXG4gICAgZnVuY3Rpb24gZmlsdGVyKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XG5cbiAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDA7XG5cbiAgICAgIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHZhbHVlID0gY29sbGVjdGlvbltpbmRleF07XG4gICAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpIHtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvck93bihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICBpZiAoY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSkge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEl0ZXJhdGVzIG92ZXIgZWxlbWVudHMgb2YgYSBjb2xsZWN0aW9uLCByZXR1cm5pbmcgdGhlIGZpcnN0IGVsZW1lbnQgdGhhdFxuICAgICAqIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWV5IGZvci4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmRcbiAgICAgKiBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBhbGlhcyBkZXRlY3QsIGZpbmRXaGVyZVxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgZm91bmQgZWxlbWVudCwgZWxzZSBgdW5kZWZpbmVkYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICAnYWdlJzogMzYsICdibG9ja2VkJzogZmFsc2UgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgICdhZ2UnOiA0MCwgJ2Jsb2NrZWQnOiB0cnVlIH0sXG4gICAgICogICB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYWdlJzogMSwgICdibG9ja2VkJzogZmFsc2UgfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiBfLmZpbmQoY2hhcmFjdGVycywgZnVuY3Rpb24oY2hyKSB7XG4gICAgICogICByZXR1cm4gY2hyLmFnZSA8IDQwO1xuICAgICAqIH0pO1xuICAgICAqIC8vID0+IHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IGZhbHNlIH1cbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy53aGVyZVwiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8uZmluZChjaGFyYWN0ZXJzLCB7ICdhZ2UnOiAxIH0pO1xuICAgICAqIC8vID0+ICB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYWdlJzogMSwgJ2Jsb2NrZWQnOiBmYWxzZSB9XG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmZpbmQoY2hhcmFjdGVycywgJ2Jsb2NrZWQnKTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2ZyZWQnLCAnYWdlJzogNDAsICdibG9ja2VkJzogdHJ1ZSB9XG4gICAgICovXG4gICAgZnVuY3Rpb24gZmluZChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xuXG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xuXG4gICAgICBpZiAodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJykge1xuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IGNvbGxlY3Rpb25baW5kZXhdO1xuICAgICAgICAgIGlmIChjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVzdWx0O1xuICAgICAgICBmb3JPd24oY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5maW5kYCBleGNlcHQgdGhhdCBpdCBpdGVyYXRlcyBvdmVyIGVsZW1lbnRzXG4gICAgICogb2YgYSBgY29sbGVjdGlvbmAgZnJvbSByaWdodCB0byBsZWZ0LlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgICAqICBwZXIgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZFxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBmb3VuZCBlbGVtZW50LCBlbHNlIGB1bmRlZmluZWRgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmZpbmRMYXN0KFsxLCAyLCAzLCA0XSwgZnVuY3Rpb24obnVtKSB7XG4gICAgICogICByZXR1cm4gbnVtICUgMiA9PSAxO1xuICAgICAqIH0pO1xuICAgICAqIC8vID0+IDNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBmaW5kTGFzdChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgdmFyIHJlc3VsdDtcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgIGZvckVhY2hSaWdodChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpIHtcbiAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJdGVyYXRlcyBvdmVyIGVsZW1lbnRzIG9mIGEgY29sbGVjdGlvbiwgZXhlY3V0aW5nIHRoZSBjYWxsYmFjayBmb3IgZWFjaFxuICAgICAqIGVsZW1lbnQuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7XG4gICAgICogKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLiBDYWxsYmFja3MgbWF5IGV4aXQgaXRlcmF0aW9uIGVhcmx5IGJ5XG4gICAgICogZXhwbGljaXRseSByZXR1cm5pbmcgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIE5vdGU6IEFzIHdpdGggb3RoZXIgXCJDb2xsZWN0aW9uc1wiIG1ldGhvZHMsIG9iamVjdHMgd2l0aCBhIGBsZW5ndGhgIHByb3BlcnR5XG4gICAgICogYXJlIGl0ZXJhdGVkIGxpa2UgYXJyYXlzLiBUbyBhdm9pZCB0aGlzIGJlaGF2aW9yIGBfLmZvckluYCBvciBgXy5mb3JPd25gXG4gICAgICogbWF5IGJlIHVzZWQgZm9yIG9iamVjdCBpdGVyYXRpb24uXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAYWxpYXMgZWFjaFxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge0FycmF5fE9iamVjdHxzdHJpbmd9IFJldHVybnMgYGNvbGxlY3Rpb25gLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfKFsxLCAyLCAzXSkuZm9yRWFjaChmdW5jdGlvbihudW0pIHsgY29uc29sZS5sb2cobnVtKTsgfSkuam9pbignLCcpO1xuICAgICAqIC8vID0+IGxvZ3MgZWFjaCBudW1iZXIgYW5kIHJldHVybnMgJzEsMiwzJ1xuICAgICAqXG4gICAgICogXy5mb3JFYWNoKHsgJ29uZSc6IDEsICd0d28nOiAyLCAndGhyZWUnOiAzIH0sIGZ1bmN0aW9uKG51bSkgeyBjb25zb2xlLmxvZyhudW0pOyB9KTtcbiAgICAgKiAvLyA9PiBsb2dzIGVhY2ggbnVtYmVyIGFuZCByZXR1cm5zIHRoZSBvYmplY3QgKHByb3BlcnR5IG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkIGFjcm9zcyBlbnZpcm9ubWVudHMpXG4gICAgICovXG4gICAgZnVuY3Rpb24gZm9yRWFjaChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMDtcblxuICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayAmJiB0eXBlb2YgdGhpc0FyZyA9PSAndW5kZWZpbmVkJyA/IGNhbGxiYWNrIDogYmFzZUNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKGNhbGxiYWNrKGNvbGxlY3Rpb25baW5kZXhdLCBpbmRleCwgY29sbGVjdGlvbikgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvck93bihjb2xsZWN0aW9uLCBjYWxsYmFjayk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY29sbGVjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmZvckVhY2hgIGV4Y2VwdCB0aGF0IGl0IGl0ZXJhdGVzIG92ZXIgZWxlbWVudHNcbiAgICAgKiBvZiBhIGBjb2xsZWN0aW9uYCBmcm9tIHJpZ2h0IHRvIGxlZnQuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAYWxpYXMgZWFjaFJpZ2h0XG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl8T2JqZWN0fHN0cmluZ30gUmV0dXJucyBgY29sbGVjdGlvbmAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8oWzEsIDIsIDNdKS5mb3JFYWNoUmlnaHQoZnVuY3Rpb24obnVtKSB7IGNvbnNvbGUubG9nKG51bSk7IH0pLmpvaW4oJywnKTtcbiAgICAgKiAvLyA9PiBsb2dzIGVhY2ggbnVtYmVyIGZyb20gcmlnaHQgdG8gbGVmdCBhbmQgcmV0dXJucyAnMywyLDEnXG4gICAgICovXG4gICAgZnVuY3Rpb24gZm9yRWFjaFJpZ2h0KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMDtcbiAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgJiYgdHlwZW9mIHRoaXNBcmcgPT0gJ3VuZGVmaW5lZCcgPyBjYWxsYmFjayA6IGJhc2VDcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XG4gICAgICBpZiAodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJykge1xuICAgICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgICBpZiAoY2FsbGJhY2soY29sbGVjdGlvbltsZW5ndGhdLCBsZW5ndGgsIGNvbGxlY3Rpb24pID09PSBmYWxzZSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcHJvcHMgPSBrZXlzKGNvbGxlY3Rpb24pO1xuICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGg7XG4gICAgICAgIGZvck93bihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAga2V5ID0gcHJvcHMgPyBwcm9wc1stLWxlbmd0aF0gOiAtLWxlbmd0aDtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY29sbGVjdGlvbltrZXldLCBrZXksIGNvbGxlY3Rpb24pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb2xsZWN0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gb2JqZWN0IGNvbXBvc2VkIG9mIGtleXMgZ2VuZXJhdGVkIGZyb20gdGhlIHJlc3VsdHMgb2YgcnVubmluZ1xuICAgICAqIGVhY2ggZWxlbWVudCBvZiBhIGNvbGxlY3Rpb24gdGhyb3VnaCB0aGUgY2FsbGJhY2suIFRoZSBjb3JyZXNwb25kaW5nIHZhbHVlXG4gICAgICogb2YgZWFjaCBrZXkgaXMgYW4gYXJyYXkgb2YgdGhlIGVsZW1lbnRzIHJlc3BvbnNpYmxlIGZvciBnZW5lcmF0aW5nIHRoZSBrZXkuXG4gICAgICogVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50cztcbiAgICAgKiAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYFxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgICAqICBwZXIgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZFxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGNvbXBvc2VkIGFnZ3JlZ2F0ZSBvYmplY3QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uZ3JvdXBCeShbNC4yLCA2LjEsIDYuNF0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gTWF0aC5mbG9vcihudW0pOyB9KTtcbiAgICAgKiAvLyA9PiB7ICc0JzogWzQuMl0sICc2JzogWzYuMSwgNi40XSB9XG4gICAgICpcbiAgICAgKiBfLmdyb3VwQnkoWzQuMiwgNi4xLCA2LjRdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIHRoaXMuZmxvb3IobnVtKTsgfSwgTWF0aCk7XG4gICAgICogLy8gPT4geyAnNCc6IFs0LjJdLCAnNic6IFs2LjEsIDYuNF0gfVxuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5ncm91cEJ5KFsnb25lJywgJ3R3bycsICd0aHJlZSddLCAnbGVuZ3RoJyk7XG4gICAgICogLy8gPT4geyAnMyc6IFsnb25lJywgJ3R3byddLCAnNSc6IFsndGhyZWUnXSB9XG4gICAgICovXG4gICAgdmFyIGdyb3VwQnkgPSBjcmVhdGVBZ2dyZWdhdG9yKGZ1bmN0aW9uKHJlc3VsdCwgdmFsdWUsIGtleSkge1xuICAgICAgKGhhc093blByb3BlcnR5LmNhbGwocmVzdWx0LCBrZXkpID8gcmVzdWx0W2tleV0gOiByZXN1bHRba2V5XSA9IFtdKS5wdXNoKHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gb2JqZWN0IGNvbXBvc2VkIG9mIGtleXMgZ2VuZXJhdGVkIGZyb20gdGhlIHJlc3VsdHMgb2YgcnVubmluZ1xuICAgICAqIGVhY2ggZWxlbWVudCBvZiB0aGUgY29sbGVjdGlvbiB0aHJvdWdoIHRoZSBnaXZlbiBjYWxsYmFjay4gVGhlIGNvcnJlc3BvbmRpbmdcbiAgICAgKiB2YWx1ZSBvZiBlYWNoIGtleSBpcyB0aGUgbGFzdCBlbGVtZW50IHJlc3BvbnNpYmxlIGZvciBnZW5lcmF0aW5nIHRoZSBrZXkuXG4gICAgICogVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50cztcbiAgICAgKiAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBjb21wb3NlZCBhZ2dyZWdhdGUgb2JqZWN0LlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIga2V5cyA9IFtcbiAgICAgKiAgIHsgJ2Rpcic6ICdsZWZ0JywgJ2NvZGUnOiA5NyB9LFxuICAgICAqICAgeyAnZGlyJzogJ3JpZ2h0JywgJ2NvZGUnOiAxMDAgfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiBfLmluZGV4Qnkoa2V5cywgJ2RpcicpO1xuICAgICAqIC8vID0+IHsgJ2xlZnQnOiB7ICdkaXInOiAnbGVmdCcsICdjb2RlJzogOTcgfSwgJ3JpZ2h0JzogeyAnZGlyJzogJ3JpZ2h0JywgJ2NvZGUnOiAxMDAgfSB9XG4gICAgICpcbiAgICAgKiBfLmluZGV4Qnkoa2V5cywgZnVuY3Rpb24oa2V5KSB7IHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGtleS5jb2RlKTsgfSk7XG4gICAgICogLy8gPT4geyAnYSc6IHsgJ2Rpcic6ICdsZWZ0JywgJ2NvZGUnOiA5NyB9LCAnZCc6IHsgJ2Rpcic6ICdyaWdodCcsICdjb2RlJzogMTAwIH0gfVxuICAgICAqXG4gICAgICogXy5pbmRleEJ5KGNoYXJhY3RlcnMsIGZ1bmN0aW9uKGtleSkgeyB0aGlzLmZyb21DaGFyQ29kZShrZXkuY29kZSk7IH0sIFN0cmluZyk7XG4gICAgICogLy8gPT4geyAnYSc6IHsgJ2Rpcic6ICdsZWZ0JywgJ2NvZGUnOiA5NyB9LCAnZCc6IHsgJ2Rpcic6ICdyaWdodCcsICdjb2RlJzogMTAwIH0gfVxuICAgICAqL1xuICAgIHZhciBpbmRleEJ5ID0gY3JlYXRlQWdncmVnYXRvcihmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VzIHRoZSBtZXRob2QgbmFtZWQgYnkgYG1ldGhvZE5hbWVgIG9uIGVhY2ggZWxlbWVudCBpbiB0aGUgYGNvbGxlY3Rpb25gXG4gICAgICogcmV0dXJuaW5nIGFuIGFycmF5IG9mIHRoZSByZXN1bHRzIG9mIGVhY2ggaW52b2tlZCBtZXRob2QuIEFkZGl0aW9uYWwgYXJndW1lbnRzXG4gICAgICogd2lsbCBiZSBwcm92aWRlZCB0byBlYWNoIGludm9rZWQgbWV0aG9kLiBJZiBgbWV0aG9kTmFtZWAgaXMgYSBmdW5jdGlvbiBpdFxuICAgICAqIHdpbGwgYmUgaW52b2tlZCBmb3IsIGFuZCBgdGhpc2AgYm91bmQgdG8sIGVhY2ggZWxlbWVudCBpbiB0aGUgYGNvbGxlY3Rpb25gLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufHN0cmluZ30gbWV0aG9kTmFtZSBUaGUgbmFtZSBvZiB0aGUgbWV0aG9kIHRvIGludm9rZSBvclxuICAgICAqICB0aGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7Li4uKn0gW2FyZ10gQXJndW1lbnRzIHRvIGludm9rZSB0aGUgbWV0aG9kIHdpdGguXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHRoZSByZXN1bHRzIG9mIGVhY2ggaW52b2tlZCBtZXRob2QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uaW52b2tlKFtbNSwgMSwgN10sIFszLCAyLCAxXV0sICdzb3J0Jyk7XG4gICAgICogLy8gPT4gW1sxLCA1LCA3XSwgWzEsIDIsIDNdXVxuICAgICAqXG4gICAgICogXy5pbnZva2UoWzEyMywgNDU2XSwgU3RyaW5nLnByb3RvdHlwZS5zcGxpdCwgJycpO1xuICAgICAqIC8vID0+IFtbJzEnLCAnMicsICczJ10sIFsnNCcsICc1JywgJzYnXV1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpbnZva2UoY29sbGVjdGlvbiwgbWV0aG9kTmFtZSkge1xuICAgICAgdmFyIGFyZ3MgPSBzbGljZShhcmd1bWVudHMsIDIpLFxuICAgICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgICAgaXNGdW5jID0gdHlwZW9mIG1ldGhvZE5hbWUgPT0gJ2Z1bmN0aW9uJyxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwLFxuICAgICAgICAgIHJlc3VsdCA9IEFycmF5KHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgPyBsZW5ndGggOiAwKTtcblxuICAgICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXN1bHRbKytpbmRleF0gPSAoaXNGdW5jID8gbWV0aG9kTmFtZSA6IHZhbHVlW21ldGhvZE5hbWVdKS5hcHBseSh2YWx1ZSwgYXJncyk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiB2YWx1ZXMgYnkgcnVubmluZyBlYWNoIGVsZW1lbnQgaW4gdGhlIGNvbGxlY3Rpb25cbiAgICAgKiB0aHJvdWdoIHRoZSBjYWxsYmFjay4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoXG4gICAgICogdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBhbGlhcyBjb2xsZWN0XG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgICAqICBwZXIgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZFxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiB0aGUgcmVzdWx0cyBvZiBlYWNoIGBjYWxsYmFja2AgZXhlY3V0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLm1hcChbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtICogMzsgfSk7XG4gICAgICogLy8gPT4gWzMsIDYsIDldXG4gICAgICpcbiAgICAgKiBfLm1hcCh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9LCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAqIDM7IH0pO1xuICAgICAqIC8vID0+IFszLCA2LCA5XSAocHJvcGVydHkgb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQgYWNyb3NzIGVudmlyb25tZW50cylcbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cbiAgICAgKiBdO1xuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5tYXAoY2hhcmFjdGVycywgJ25hbWUnKTtcbiAgICAgKiAvLyA9PiBbJ2Jhcm5leScsICdmcmVkJ11cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBtYXAoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDA7XG5cbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdFtpbmRleF0gPSBjYWxsYmFjayhjb2xsZWN0aW9uW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBbXTtcbiAgICAgICAgZm9yT3duKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICByZXN1bHRbKytpbmRleF0gPSBjYWxsYmFjayh2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgbWF4aW11bSB2YWx1ZSBvZiBhIGNvbGxlY3Rpb24uIElmIHRoZSBjb2xsZWN0aW9uIGlzIGVtcHR5IG9yXG4gICAgICogZmFsc2V5IGAtSW5maW5pdHlgIGlzIHJldHVybmVkLiBJZiBhIGNhbGxiYWNrIGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgZXhlY3V0ZWRcbiAgICAgKiBmb3IgZWFjaCB2YWx1ZSBpbiB0aGUgY29sbGVjdGlvbiB0byBnZW5lcmF0ZSB0aGUgY3JpdGVyaW9uIGJ5IHdoaWNoIHRoZSB2YWx1ZVxuICAgICAqIGlzIHJhbmtlZC4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlXG4gICAgICogYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKS5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgICAqICBwZXIgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZFxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBtYXhpbXVtIHZhbHVlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLm1heChbNCwgMiwgOCwgNl0pO1xuICAgICAqIC8vID0+IDhcbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cbiAgICAgKiBdO1xuICAgICAqXG4gICAgICogXy5tYXgoY2hhcmFjdGVycywgZnVuY3Rpb24oY2hyKSB7IHJldHVybiBjaHIuYWdlOyB9KTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2ZyZWQnLCAnYWdlJzogNDAgfTtcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8ubWF4KGNoYXJhY3RlcnMsICdhZ2UnKTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2ZyZWQnLCAnYWdlJzogNDAgfTtcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBtYXgoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIHZhciBjb21wdXRlZCA9IC1JbmZpbml0eSxcbiAgICAgICAgICByZXN1bHQgPSBjb21wdXRlZDtcblxuICAgICAgLy8gYWxsb3dzIHdvcmtpbmcgd2l0aCBmdW5jdGlvbnMgbGlrZSBgXy5tYXBgIHdpdGhvdXQgdXNpbmdcbiAgICAgIC8vIHRoZWlyIGBpbmRleGAgYXJndW1lbnQgYXMgYSBjYWxsYmFja1xuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nICYmIHRoaXNBcmcgJiYgdGhpc0FyZ1tjYWxsYmFja10gPT09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgY2FsbGJhY2sgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKGNhbGxiYWNrID09IG51bGwgJiYgaXNBcnJheShjb2xsZWN0aW9uKSkge1xuICAgICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24ubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHZhbHVlID0gY29sbGVjdGlvbltpbmRleF07XG4gICAgICAgICAgaWYgKHZhbHVlID4gcmVzdWx0KSB7XG4gICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrID0gKGNhbGxiYWNrID09IG51bGwgJiYgaXNTdHJpbmcoY29sbGVjdGlvbikpXG4gICAgICAgICAgPyBjaGFyQXRDYWxsYmFja1xuICAgICAgICAgIDogbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcblxuICAgICAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICAgIHZhciBjdXJyZW50ID0gY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgICAgICBpZiAoY3VycmVudCA+IGNvbXB1dGVkKSB7XG4gICAgICAgICAgICBjb21wdXRlZCA9IGN1cnJlbnQ7XG4gICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIG1pbmltdW0gdmFsdWUgb2YgYSBjb2xsZWN0aW9uLiBJZiB0aGUgY29sbGVjdGlvbiBpcyBlbXB0eSBvclxuICAgICAqIGZhbHNleSBgSW5maW5pdHlgIGlzIHJldHVybmVkLiBJZiBhIGNhbGxiYWNrIGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgZXhlY3V0ZWRcbiAgICAgKiBmb3IgZWFjaCB2YWx1ZSBpbiB0aGUgY29sbGVjdGlvbiB0byBnZW5lcmF0ZSB0aGUgY3JpdGVyaW9uIGJ5IHdoaWNoIHRoZSB2YWx1ZVxuICAgICAqIGlzIHJhbmtlZC4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlXG4gICAgICogYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKS5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgICAqICBwZXIgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZFxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBtaW5pbXVtIHZhbHVlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLm1pbihbNCwgMiwgOCwgNl0pO1xuICAgICAqIC8vID0+IDJcbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cbiAgICAgKiBdO1xuICAgICAqXG4gICAgICogXy5taW4oY2hhcmFjdGVycywgZnVuY3Rpb24oY2hyKSB7IHJldHVybiBjaHIuYWdlOyB9KTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9O1xuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5taW4oY2hhcmFjdGVycywgJ2FnZScpO1xuICAgICAqIC8vID0+IHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH07XG4gICAgICovXG4gICAgZnVuY3Rpb24gbWluKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgY29tcHV0ZWQgPSBJbmZpbml0eSxcbiAgICAgICAgICByZXN1bHQgPSBjb21wdXRlZDtcblxuICAgICAgLy8gYWxsb3dzIHdvcmtpbmcgd2l0aCBmdW5jdGlvbnMgbGlrZSBgXy5tYXBgIHdpdGhvdXQgdXNpbmdcbiAgICAgIC8vIHRoZWlyIGBpbmRleGAgYXJndW1lbnQgYXMgYSBjYWxsYmFja1xuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nICYmIHRoaXNBcmcgJiYgdGhpc0FyZ1tjYWxsYmFja10gPT09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgY2FsbGJhY2sgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKGNhbGxiYWNrID09IG51bGwgJiYgaXNBcnJheShjb2xsZWN0aW9uKSkge1xuICAgICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24ubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHZhbHVlID0gY29sbGVjdGlvbltpbmRleF07XG4gICAgICAgICAgaWYgKHZhbHVlIDwgcmVzdWx0KSB7XG4gICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrID0gKGNhbGxiYWNrID09IG51bGwgJiYgaXNTdHJpbmcoY29sbGVjdGlvbikpXG4gICAgICAgICAgPyBjaGFyQXRDYWxsYmFja1xuICAgICAgICAgIDogbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcblxuICAgICAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICAgIHZhciBjdXJyZW50ID0gY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgICAgICBpZiAoY3VycmVudCA8IGNvbXB1dGVkKSB7XG4gICAgICAgICAgICBjb21wdXRlZCA9IGN1cnJlbnQ7XG4gICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIHZhbHVlIG9mIGEgc3BlY2lmaWVkIHByb3BlcnR5IGZyb20gYWxsIGVsZW1lbnRzIGluIHRoZSBjb2xsZWN0aW9uLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdG8gcGx1Y2suXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHByb3BlcnR5IHZhbHVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAgfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiBfLnBsdWNrKGNoYXJhY3RlcnMsICduYW1lJyk7XG4gICAgICogLy8gPT4gWydiYXJuZXknLCAnZnJlZCddXG4gICAgICovXG4gICAgdmFyIHBsdWNrID0gbWFwO1xuXG4gICAgLyoqXG4gICAgICogUmVkdWNlcyBhIGNvbGxlY3Rpb24gdG8gYSB2YWx1ZSB3aGljaCBpcyB0aGUgYWNjdW11bGF0ZWQgcmVzdWx0IG9mIHJ1bm5pbmdcbiAgICAgKiBlYWNoIGVsZW1lbnQgaW4gdGhlIGNvbGxlY3Rpb24gdGhyb3VnaCB0aGUgY2FsbGJhY2ssIHdoZXJlIGVhY2ggc3VjY2Vzc2l2ZVxuICAgICAqIGNhbGxiYWNrIGV4ZWN1dGlvbiBjb25zdW1lcyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBwcmV2aW91cyBleGVjdXRpb24uIElmXG4gICAgICogYGFjY3VtdWxhdG9yYCBpcyBub3QgcHJvdmlkZWQgdGhlIGZpcnN0IGVsZW1lbnQgb2YgdGhlIGNvbGxlY3Rpb24gd2lsbCBiZVxuICAgICAqIHVzZWQgYXMgdGhlIGluaXRpYWwgYGFjY3VtdWxhdG9yYCB2YWx1ZS4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYFxuICAgICAqIGFuZCBpbnZva2VkIHdpdGggZm91ciBhcmd1bWVudHM7IChhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAYWxpYXMgZm9sZGwsIGluamVjdFxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAgICogQHBhcmFtIHsqfSBbYWNjdW11bGF0b3JdIEluaXRpYWwgdmFsdWUgb2YgdGhlIGFjY3VtdWxhdG9yLlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBhY2N1bXVsYXRlZCB2YWx1ZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIHN1bSA9IF8ucmVkdWNlKFsxLCAyLCAzXSwgZnVuY3Rpb24oc3VtLCBudW0pIHtcbiAgICAgKiAgIHJldHVybiBzdW0gKyBudW07XG4gICAgICogfSk7XG4gICAgICogLy8gPT4gNlxuICAgICAqXG4gICAgICogdmFyIG1hcHBlZCA9IF8ucmVkdWNlKHsgJ2EnOiAxLCAnYic6IDIsICdjJzogMyB9LCBmdW5jdGlvbihyZXN1bHQsIG51bSwga2V5KSB7XG4gICAgICogICByZXN1bHRba2V5XSA9IG51bSAqIDM7XG4gICAgICogICByZXR1cm4gcmVzdWx0O1xuICAgICAqIH0sIHt9KTtcbiAgICAgKiAvLyA9PiB7ICdhJzogMywgJ2InOiA2LCAnYyc6IDkgfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlZHVjZShjb2xsZWN0aW9uLCBjYWxsYmFjaywgYWNjdW11bGF0b3IsIHRoaXNBcmcpIHtcbiAgICAgIGlmICghY29sbGVjdGlvbikgcmV0dXJuIGFjY3VtdWxhdG9yO1xuICAgICAgdmFyIG5vYWNjdW0gPSBhcmd1bWVudHMubGVuZ3RoIDwgMztcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCA0KTtcblxuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbi5sZW5ndGg7XG5cbiAgICAgIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICAgIGlmIChub2FjY3VtKSB7XG4gICAgICAgICAgYWNjdW11bGF0b3IgPSBjb2xsZWN0aW9uWysraW5kZXhdO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgYWNjdW11bGF0b3IgPSBjYWxsYmFjayhhY2N1bXVsYXRvciwgY29sbGVjdGlvbltpbmRleF0sIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yT3duKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICAgIGFjY3VtdWxhdG9yID0gbm9hY2N1bVxuICAgICAgICAgICAgPyAobm9hY2N1bSA9IGZhbHNlLCB2YWx1ZSlcbiAgICAgICAgICAgIDogY2FsbGJhY2soYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbilcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWNjdW11bGF0b3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5yZWR1Y2VgIGV4Y2VwdCB0aGF0IGl0IGl0ZXJhdGVzIG92ZXIgZWxlbWVudHNcbiAgICAgKiBvZiBhIGBjb2xsZWN0aW9uYCBmcm9tIHJpZ2h0IHRvIGxlZnQuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAYWxpYXMgZm9sZHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7Kn0gW2FjY3VtdWxhdG9yXSBJbml0aWFsIHZhbHVlIG9mIHRoZSBhY2N1bXVsYXRvci5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgYWNjdW11bGF0ZWQgdmFsdWUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBsaXN0ID0gW1swLCAxXSwgWzIsIDNdLCBbNCwgNV1dO1xuICAgICAqIHZhciBmbGF0ID0gXy5yZWR1Y2VSaWdodChsaXN0LCBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhLmNvbmNhdChiKTsgfSwgW10pO1xuICAgICAqIC8vID0+IFs0LCA1LCAyLCAzLCAwLCAxXVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlZHVjZVJpZ2h0KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCBhY2N1bXVsYXRvciwgdGhpc0FyZykge1xuICAgICAgdmFyIG5vYWNjdW0gPSBhcmd1bWVudHMubGVuZ3RoIDwgMztcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCA0KTtcbiAgICAgIGZvckVhY2hSaWdodChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgYWNjdW11bGF0b3IgPSBub2FjY3VtXG4gICAgICAgICAgPyAobm9hY2N1bSA9IGZhbHNlLCB2YWx1ZSlcbiAgICAgICAgICA6IGNhbGxiYWNrKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gYWNjdW11bGF0b3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG9wcG9zaXRlIG9mIGBfLmZpbHRlcmAgdGhpcyBtZXRob2QgcmV0dXJucyB0aGUgZWxlbWVudHMgb2YgYVxuICAgICAqIGNvbGxlY3Rpb24gdGhhdCB0aGUgY2FsbGJhY2sgZG9lcyAqKm5vdCoqIHJldHVybiB0cnVleSBmb3IuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgdGhhdCBmYWlsZWQgdGhlIGNhbGxiYWNrIGNoZWNrLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgb2RkcyA9IF8ucmVqZWN0KFsxLCAyLCAzLCA0LCA1LCA2XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gJSAyID09IDA7IH0pO1xuICAgICAqIC8vID0+IFsxLCAzLCA1XVxuICAgICAqXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiwgJ2Jsb2NrZWQnOiBmYWxzZSB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAsICdibG9ja2VkJzogdHJ1ZSB9XG4gICAgICogXTtcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8ucmVqZWN0KGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XG4gICAgICogLy8gPT4gW3sgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IGZhbHNlIH1dXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLnJlamVjdChjaGFyYWN0ZXJzLCB7ICdhZ2UnOiAzNiB9KTtcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdmcmVkJywgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IHRydWUgfV1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZWplY3QoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgIHJldHVybiBmaWx0ZXIoY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgIHJldHVybiAhY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIHJhbmRvbSBlbGVtZW50IG9yIGBuYCByYW5kb20gZWxlbWVudHMgZnJvbSBhIGNvbGxlY3Rpb24uXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gc2FtcGxlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbl0gVGhlIG51bWJlciBvZiBlbGVtZW50cyB0byBzYW1wbGUuXG4gICAgICogQHBhcmFtLSB7T2JqZWN0fSBbZ3VhcmRdIEFsbG93cyB3b3JraW5nIHdpdGggZnVuY3Rpb25zIGxpa2UgYF8ubWFwYFxuICAgICAqICB3aXRob3V0IHVzaW5nIHRoZWlyIGBpbmRleGAgYXJndW1lbnRzIGFzIGBuYC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIHJhbmRvbSBzYW1wbGUocykgb2YgYGNvbGxlY3Rpb25gLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLnNhbXBsZShbMSwgMiwgMywgNF0pO1xuICAgICAqIC8vID0+IDJcbiAgICAgKlxuICAgICAqIF8uc2FtcGxlKFsxLCAyLCAzLCA0XSwgMik7XG4gICAgICogLy8gPT4gWzMsIDFdXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2FtcGxlKGNvbGxlY3Rpb24sIG4sIGd1YXJkKSB7XG4gICAgICBpZiAoY29sbGVjdGlvbiAmJiB0eXBlb2YgY29sbGVjdGlvbi5sZW5ndGggIT0gJ251bWJlcicpIHtcbiAgICAgICAgY29sbGVjdGlvbiA9IHZhbHVlcyhjb2xsZWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHtcbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uW2Jhc2VSYW5kb20oMCwgY29sbGVjdGlvbi5sZW5ndGggLSAxKV0gOiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICB2YXIgcmVzdWx0ID0gc2h1ZmZsZShjb2xsZWN0aW9uKTtcbiAgICAgIHJlc3VsdC5sZW5ndGggPSBuYXRpdmVNaW4obmF0aXZlTWF4KDAsIG4pLCByZXN1bHQubGVuZ3RoKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiBzaHVmZmxlZCB2YWx1ZXMsIHVzaW5nIGEgdmVyc2lvbiBvZiB0aGUgRmlzaGVyLVlhdGVzXG4gICAgICogc2h1ZmZsZS4gU2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRmlzaGVyLVlhdGVzX3NodWZmbGUuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gc2h1ZmZsZS5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgc2h1ZmZsZWQgY29sbGVjdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5zaHVmZmxlKFsxLCAyLCAzLCA0LCA1LCA2XSk7XG4gICAgICogLy8gPT4gWzQsIDEsIDYsIDMsIDUsIDJdXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2h1ZmZsZShjb2xsZWN0aW9uKSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwLFxuICAgICAgICAgIHJlc3VsdCA9IEFycmF5KHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgPyBsZW5ndGggOiAwKTtcblxuICAgICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB2YXIgcmFuZCA9IGJhc2VSYW5kb20oMCwgKytpbmRleCk7XG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSByZXN1bHRbcmFuZF07XG4gICAgICAgIHJlc3VsdFtyYW5kXSA9IHZhbHVlO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHNpemUgb2YgdGhlIGBjb2xsZWN0aW9uYCBieSByZXR1cm5pbmcgYGNvbGxlY3Rpb24ubGVuZ3RoYCBmb3IgYXJyYXlzXG4gICAgICogYW5kIGFycmF5LWxpa2Ugb2JqZWN0cyBvciB0aGUgbnVtYmVyIG9mIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgZm9yIG9iamVjdHMuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaW5zcGVjdC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIGBjb2xsZWN0aW9uLmxlbmd0aGAgb3IgbnVtYmVyIG9mIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uc2l6ZShbMSwgMl0pO1xuICAgICAqIC8vID0+IDJcbiAgICAgKlxuICAgICAqIF8uc2l6ZSh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9KTtcbiAgICAgKiAvLyA9PiAzXG4gICAgICpcbiAgICAgKiBfLnNpemUoJ3BlYmJsZXMnKTtcbiAgICAgKiAvLyA9PiA3XG4gICAgICovXG4gICAgZnVuY3Rpb24gc2l6ZShjb2xsZWN0aW9uKSB7XG4gICAgICB2YXIgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMDtcbiAgICAgIHJldHVybiB0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInID8gbGVuZ3RoIDoga2V5cyhjb2xsZWN0aW9uKS5sZW5ndGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIHRoZSBjYWxsYmFjayByZXR1cm5zIGEgdHJ1ZXkgdmFsdWUgZm9yICoqYW55KiogZWxlbWVudCBvZiBhXG4gICAgICogY29sbGVjdGlvbi4gVGhlIGZ1bmN0aW9uIHJldHVybnMgYXMgc29vbiBhcyBpdCBmaW5kcyBhIHBhc3NpbmcgdmFsdWUgYW5kXG4gICAgICogZG9lcyBub3QgaXRlcmF0ZSBvdmVyIHRoZSBlbnRpcmUgY29sbGVjdGlvbi4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvXG4gICAgICogYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBhbGlhcyBhbnlcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXG4gICAgICogIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGFueSBlbGVtZW50IHBhc3NlZCB0aGUgY2FsbGJhY2sgY2hlY2ssXG4gICAgICogIGVsc2UgYGZhbHNlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5zb21lKFtudWxsLCAwLCAneWVzJywgZmFsc2VdLCBCb29sZWFuKTtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICpcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IGZhbHNlIH0sXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICdhZ2UnOiA0MCwgJ2Jsb2NrZWQnOiB0cnVlIH1cbiAgICAgKiBdO1xuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5zb21lKGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XG4gICAgICogLy8gPT4gdHJ1ZVxuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5zb21lKGNoYXJhY3RlcnMsIHsgJ2FnZSc6IDEgfSk7XG4gICAgICogLy8gPT4gZmFsc2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzb21lKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgcmVzdWx0O1xuICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xuXG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xuXG4gICAgICBpZiAodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJykge1xuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgIGlmICgocmVzdWx0ID0gY2FsbGJhY2soY29sbGVjdGlvbltpbmRleF0sIGluZGV4LCBjb2xsZWN0aW9uKSkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yT3duKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICAgIHJldHVybiAhKHJlc3VsdCA9IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAhIXJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIGVsZW1lbnRzLCBzb3J0ZWQgaW4gYXNjZW5kaW5nIG9yZGVyIGJ5IHRoZSByZXN1bHRzIG9mXG4gICAgICogcnVubmluZyBlYWNoIGVsZW1lbnQgaW4gYSBjb2xsZWN0aW9uIHRocm91Z2ggdGhlIGNhbGxiYWNrLiBUaGlzIG1ldGhvZFxuICAgICAqIHBlcmZvcm1zIGEgc3RhYmxlIHNvcnQsIHRoYXQgaXMsIGl0IHdpbGwgcHJlc2VydmUgdGhlIG9yaWdpbmFsIHNvcnQgb3JkZXJcbiAgICAgKiBvZiBlcXVhbCBlbGVtZW50cy4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoXG4gICAgICogdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcyBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY29sbGVjdGlvblxuICAgICAqIHdpbGwgYmUgc29ydGVkIGJ5IGVhY2ggcHJvcGVydHkgdmFsdWUuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtBcnJheXxGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2Ygc29ydGVkIGVsZW1lbnRzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLnNvcnRCeShbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gTWF0aC5zaW4obnVtKTsgfSk7XG4gICAgICogLy8gPT4gWzMsIDEsIDJdXG4gICAgICpcbiAgICAgKiBfLnNvcnRCeShbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gdGhpcy5zaW4obnVtKTsgfSwgTWF0aCk7XG4gICAgICogLy8gPT4gWzMsIDEsIDJdXG4gICAgICpcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgICdhZ2UnOiAzNiB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAgJ2FnZSc6IDQwIH0sXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICAnYWdlJzogMjYgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgICdhZ2UnOiAzMCB9XG4gICAgICogXTtcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8ubWFwKF8uc29ydEJ5KGNoYXJhY3RlcnMsICdhZ2UnKSwgXy52YWx1ZXMpO1xuICAgICAqIC8vID0+IFtbJ2Jhcm5leScsIDI2XSwgWydmcmVkJywgMzBdLCBbJ2Jhcm5leScsIDM2XSwgWydmcmVkJywgNDBdXVxuICAgICAqXG4gICAgICogLy8gc29ydGluZyBieSBtdWx0aXBsZSBwcm9wZXJ0aWVzXG4gICAgICogXy5tYXAoXy5zb3J0QnkoY2hhcmFjdGVycywgWyduYW1lJywgJ2FnZSddKSwgXy52YWx1ZXMpO1xuICAgICAqIC8vID0gPiBbWydiYXJuZXknLCAyNl0sIFsnYmFybmV5JywgMzZdLCBbJ2ZyZWQnLCAzMF0sIFsnZnJlZCcsIDQwXV1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzb3J0QnkoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgIGlzQXJyID0gaXNBcnJheShjYWxsYmFjayksXG4gICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMCxcbiAgICAgICAgICByZXN1bHQgPSBBcnJheSh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInID8gbGVuZ3RoIDogMCk7XG5cbiAgICAgIGlmICghaXNBcnIpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xuICAgICAgfVxuICAgICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgIHZhciBvYmplY3QgPSByZXN1bHRbKytpbmRleF0gPSBnZXRPYmplY3QoKTtcbiAgICAgICAgaWYgKGlzQXJyKSB7XG4gICAgICAgICAgb2JqZWN0LmNyaXRlcmlhID0gbWFwKGNhbGxiYWNrLCBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHZhbHVlW2tleV07IH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIChvYmplY3QuY3JpdGVyaWEgPSBnZXRBcnJheSgpKVswXSA9IGNhbGxiYWNrKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pO1xuICAgICAgICB9XG4gICAgICAgIG9iamVjdC5pbmRleCA9IGluZGV4O1xuICAgICAgICBvYmplY3QudmFsdWUgPSB2YWx1ZTtcbiAgICAgIH0pO1xuXG4gICAgICBsZW5ndGggPSByZXN1bHQubGVuZ3RoO1xuICAgICAgcmVzdWx0LnNvcnQoY29tcGFyZUFzY2VuZGluZyk7XG4gICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgdmFyIG9iamVjdCA9IHJlc3VsdFtsZW5ndGhdO1xuICAgICAgICByZXN1bHRbbGVuZ3RoXSA9IG9iamVjdC52YWx1ZTtcbiAgICAgICAgaWYgKCFpc0Fycikge1xuICAgICAgICAgIHJlbGVhc2VBcnJheShvYmplY3QuY3JpdGVyaWEpO1xuICAgICAgICB9XG4gICAgICAgIHJlbGVhc2VPYmplY3Qob2JqZWN0KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIGBjb2xsZWN0aW9uYCB0byBhbiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBjb252ZXJ0LlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgbmV3IGNvbnZlcnRlZCBhcnJheS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogKGZ1bmN0aW9uKCkgeyByZXR1cm4gXy50b0FycmF5KGFyZ3VtZW50cykuc2xpY2UoMSk7IH0pKDEsIDIsIDMsIDQpO1xuICAgICAqIC8vID0+IFsyLCAzLCA0XVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHRvQXJyYXkoY29sbGVjdGlvbikge1xuICAgICAgaWYgKGNvbGxlY3Rpb24gJiYgdHlwZW9mIGNvbGxlY3Rpb24ubGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICAgIHJldHVybiBzbGljZShjb2xsZWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZXMoY29sbGVjdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGVyZm9ybXMgYSBkZWVwIGNvbXBhcmlzb24gb2YgZWFjaCBlbGVtZW50IGluIGEgYGNvbGxlY3Rpb25gIHRvIHRoZSBnaXZlblxuICAgICAqIGBwcm9wZXJ0aWVzYCBvYmplY3QsIHJldHVybmluZyBhbiBhcnJheSBvZiBhbGwgZWxlbWVudHMgdGhhdCBoYXZlIGVxdWl2YWxlbnRcbiAgICAgKiBwcm9wZXJ0eSB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAdHlwZSBGdW5jdGlvblxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHByb3BzIFRoZSBvYmplY3Qgb2YgcHJvcGVydHkgdmFsdWVzIHRvIGZpbHRlciBieS5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBnaXZlbiBwcm9wZXJ0aWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2LCAncGV0cyc6IFsnaG9wcHknXSB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAsICdwZXRzJzogWydiYWJ5IHB1c3MnLCAnZGlubyddIH1cbiAgICAgKiBdO1xuICAgICAqXG4gICAgICogXy53aGVyZShjaGFyYWN0ZXJzLCB7ICdhZ2UnOiAzNiB9KTtcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYsICdwZXRzJzogWydob3BweSddIH1dXG4gICAgICpcbiAgICAgKiBfLndoZXJlKGNoYXJhY3RlcnMsIHsgJ3BldHMnOiBbJ2Rpbm8nXSB9KTtcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdmcmVkJywgJ2FnZSc6IDQwLCAncGV0cyc6IFsnYmFieSBwdXNzJywgJ2Rpbm8nXSB9XVxuICAgICAqL1xuICAgIHZhciB3aGVyZSA9IGZpbHRlcjtcblxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSB3aXRoIGFsbCBmYWxzZXkgdmFsdWVzIHJlbW92ZWQuIFRoZSB2YWx1ZXMgYGZhbHNlYCwgYG51bGxgLFxuICAgICAqIGAwYCwgYFwiXCJgLCBgdW5kZWZpbmVkYCwgYW5kIGBOYU5gIGFyZSBhbGwgZmFsc2V5LlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBjb21wYWN0LlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBmaWx0ZXJlZCB2YWx1ZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uY29tcGFjdChbMCwgMSwgZmFsc2UsIDIsICcnLCAzXSk7XG4gICAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAgICovXG4gICAgZnVuY3Rpb24gY29tcGFjdChhcnJheSkge1xuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxuICAgICAgICAgIHJlc3VsdCA9IFtdO1xuXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF07XG4gICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IGV4Y2x1ZGluZyBhbGwgdmFsdWVzIG9mIHRoZSBwcm92aWRlZCBhcnJheXMgdXNpbmcgc3RyaWN0XG4gICAgICogZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBwcm9jZXNzLlxuICAgICAqIEBwYXJhbSB7Li4uQXJyYXl9IFt2YWx1ZXNdIFRoZSBhcnJheXMgb2YgdmFsdWVzIHRvIGV4Y2x1ZGUuXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGZpbHRlcmVkIHZhbHVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5kaWZmZXJlbmNlKFsxLCAyLCAzLCA0LCA1XSwgWzUsIDIsIDEwXSk7XG4gICAgICogLy8gPT4gWzEsIDMsIDRdXG4gICAgICovXG4gICAgZnVuY3Rpb24gZGlmZmVyZW5jZShhcnJheSkge1xuICAgICAgcmV0dXJuIGJhc2VEaWZmZXJlbmNlKGFycmF5LCBiYXNlRmxhdHRlbihhcmd1bWVudHMsIHRydWUsIHRydWUsIDEpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmZpbmRgIGV4Y2VwdCB0aGF0IGl0IHJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBmaXJzdFxuICAgICAqIGVsZW1lbnQgdGhhdCBwYXNzZXMgdGhlIGNhbGxiYWNrIGNoZWNrLCBpbnN0ZWFkIG9mIHRoZSBlbGVtZW50IGl0c2VsZi5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBpbmRleCBvZiB0aGUgZm91bmQgZWxlbWVudCwgZWxzZSBgLTFgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgICdhZ2UnOiAzNiwgJ2Jsb2NrZWQnOiBmYWxzZSB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IHRydWUgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAncGViYmxlcycsICdhZ2UnOiAxLCAgJ2Jsb2NrZWQnOiBmYWxzZSB9XG4gICAgICogXTtcbiAgICAgKlxuICAgICAqIF8uZmluZEluZGV4KGNoYXJhY3RlcnMsIGZ1bmN0aW9uKGNocikge1xuICAgICAqICAgcmV0dXJuIGNoci5hZ2UgPCAyMDtcbiAgICAgKiB9KTtcbiAgICAgKiAvLyA9PiAyXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmZpbmRJbmRleChjaGFyYWN0ZXJzLCB7ICdhZ2UnOiAzNiB9KTtcbiAgICAgKiAvLyA9PiAwXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmZpbmRJbmRleChjaGFyYWN0ZXJzLCAnYmxvY2tlZCcpO1xuICAgICAqIC8vID0+IDFcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBmaW5kSW5kZXgoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XG5cbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIGlmIChjYWxsYmFjayhhcnJheVtpbmRleF0sIGluZGV4LCBhcnJheSkpIHtcbiAgICAgICAgICByZXR1cm4gaW5kZXg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmZpbmRJbmRleGAgZXhjZXB0IHRoYXQgaXQgaXRlcmF0ZXMgb3ZlciBlbGVtZW50c1xuICAgICAqIG9mIGEgYGNvbGxlY3Rpb25gIGZyb20gcmlnaHQgdG8gbGVmdC5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBpbmRleCBvZiB0aGUgZm91bmQgZWxlbWVudCwgZWxzZSBgLTFgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgICdhZ2UnOiAzNiwgJ2Jsb2NrZWQnOiB0cnVlIH0sXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICAnYWdlJzogNDAsICdibG9ja2VkJzogZmFsc2UgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAncGViYmxlcycsICdhZ2UnOiAxLCAgJ2Jsb2NrZWQnOiB0cnVlIH1cbiAgICAgKiBdO1xuICAgICAqXG4gICAgICogXy5maW5kTGFzdEluZGV4KGNoYXJhY3RlcnMsIGZ1bmN0aW9uKGNocikge1xuICAgICAqICAgcmV0dXJuIGNoci5hZ2UgPiAzMDtcbiAgICAgKiB9KTtcbiAgICAgKiAvLyA9PiAxXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmZpbmRMYXN0SW5kZXgoY2hhcmFjdGVycywgeyAnYWdlJzogMzYgfSk7XG4gICAgICogLy8gPT4gMFxuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5maW5kTGFzdEluZGV4KGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XG4gICAgICogLy8gPT4gMlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGZpbmRMYXN0SW5kZXgoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xuICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xuICAgICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAgIGlmIChjYWxsYmFjayhhcnJheVtsZW5ndGhdLCBsZW5ndGgsIGFycmF5KSkge1xuICAgICAgICAgIHJldHVybiBsZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBmaXJzdCBlbGVtZW50IG9yIGZpcnN0IGBuYCBlbGVtZW50cyBvZiBhbiBhcnJheS4gSWYgYSBjYWxsYmFja1xuICAgICAqIGlzIHByb3ZpZGVkIGVsZW1lbnRzIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFycmF5IGFyZSByZXR1cm5lZCBhcyBsb25nXG4gICAgICogYXMgdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZXkuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kXG4gICAgICogaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleCwgYXJyYXkpLlxuICAgICAqXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxuICAgICAqXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcbiAgICAgKiBlbHNlIGBmYWxzZWAuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAYWxpYXMgaGVhZCwgdGFrZVxuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcXVlcnkuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8bnVtYmVyfHN0cmluZ30gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gY2FsbGVkXG4gICAgICogIHBlciBlbGVtZW50IG9yIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gcmV0dXJuLiBJZiBhIHByb3BlcnR5IG5hbWUgb3JcbiAgICAgKiAgb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZCB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIlxuICAgICAqICBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgICAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBmaXJzdCBlbGVtZW50KHMpIG9mIGBhcnJheWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uZmlyc3QoWzEsIDIsIDNdKTtcbiAgICAgKiAvLyA9PiAxXG4gICAgICpcbiAgICAgKiBfLmZpcnN0KFsxLCAyLCAzXSwgMik7XG4gICAgICogLy8gPT4gWzEsIDJdXG4gICAgICpcbiAgICAgKiBfLmZpcnN0KFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7XG4gICAgICogICByZXR1cm4gbnVtIDwgMztcbiAgICAgKiB9KTtcbiAgICAgKiAvLyA9PiBbMSwgMl1cbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAgJ2Jsb2NrZWQnOiB0cnVlLCAgJ2VtcGxveWVyJzogJ3NsYXRlJyB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAgJ2Jsb2NrZWQnOiBmYWxzZSwgJ2VtcGxveWVyJzogJ3NsYXRlJyB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdwZWJibGVzJywgJ2Jsb2NrZWQnOiB0cnVlLCAgJ2VtcGxveWVyJzogJ25hJyB9XG4gICAgICogXTtcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8uZmlyc3QoY2hhcmFjdGVycywgJ2Jsb2NrZWQnKTtcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdiYXJuZXknLCAnYmxvY2tlZCc6IHRydWUsICdlbXBsb3llcic6ICdzbGF0ZScgfV1cbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy53aGVyZVwiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8ucGx1Y2soXy5maXJzdChjaGFyYWN0ZXJzLCB7ICdlbXBsb3llcic6ICdzbGF0ZScgfSksICduYW1lJyk7XG4gICAgICogLy8gPT4gWydiYXJuZXknLCAnZnJlZCddXG4gICAgICovXG4gICAgZnVuY3Rpb24gZmlyc3QoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgbiA9IDAsXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xuXG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdudW1iZXInICYmIGNhbGxiYWNrICE9IG51bGwpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gLTE7XG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGggJiYgY2FsbGJhY2soYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpKSB7XG4gICAgICAgICAgbisrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuID0gY2FsbGJhY2s7XG4gICAgICAgIGlmIChuID09IG51bGwgfHwgdGhpc0FyZykge1xuICAgICAgICAgIHJldHVybiBhcnJheSA/IGFycmF5WzBdIDogdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gc2xpY2UoYXJyYXksIDAsIG5hdGl2ZU1pbihuYXRpdmVNYXgoMCwgbiksIGxlbmd0aCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZsYXR0ZW5zIGEgbmVzdGVkIGFycmF5ICh0aGUgbmVzdGluZyBjYW4gYmUgdG8gYW55IGRlcHRoKS4gSWYgYGlzU2hhbGxvd2BcbiAgICAgKiBpcyB0cnVleSwgdGhlIGFycmF5IHdpbGwgb25seSBiZSBmbGF0dGVuZWQgYSBzaW5nbGUgbGV2ZWwuIElmIGEgY2FsbGJhY2tcbiAgICAgKiBpcyBwcm92aWRlZCBlYWNoIGVsZW1lbnQgb2YgdGhlIGFycmF5IGlzIHBhc3NlZCB0aHJvdWdoIHRoZSBjYWxsYmFjayBiZWZvcmVcbiAgICAgKiBmbGF0dGVuaW5nLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcbiAgICAgKiBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBmbGF0dGVuLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2lzU2hhbGxvdz1mYWxzZV0gQSBmbGFnIHRvIHJlc3RyaWN0IGZsYXR0ZW5pbmcgdG8gYSBzaW5nbGUgbGV2ZWwuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgZmxhdHRlbmVkIGFycmF5LlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmZsYXR0ZW4oWzEsIFsyXSwgWzMsIFtbNF1dXV0pO1xuICAgICAqIC8vID0+IFsxLCAyLCAzLCA0XTtcbiAgICAgKlxuICAgICAqIF8uZmxhdHRlbihbMSwgWzJdLCBbMywgW1s0XV1dXSwgdHJ1ZSk7XG4gICAgICogLy8gPT4gWzEsIDIsIDMsIFtbNF1dXTtcbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzAsICdwZXRzJzogWydob3BweSddIH0sXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICdhZ2UnOiA0MCwgJ3BldHMnOiBbJ2JhYnkgcHVzcycsICdkaW5vJ10gfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmZsYXR0ZW4oY2hhcmFjdGVycywgJ3BldHMnKTtcbiAgICAgKiAvLyA9PiBbJ2hvcHB5JywgJ2JhYnkgcHVzcycsICdkaW5vJ11cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBmbGF0dGVuKGFycmF5LCBpc1NoYWxsb3csIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICAvLyBqdWdnbGUgYXJndW1lbnRzXG4gICAgICBpZiAodHlwZW9mIGlzU2hhbGxvdyAhPSAnYm9vbGVhbicgJiYgaXNTaGFsbG93ICE9IG51bGwpIHtcbiAgICAgICAgdGhpc0FyZyA9IGNhbGxiYWNrO1xuICAgICAgICBjYWxsYmFjayA9ICh0eXBlb2YgaXNTaGFsbG93ICE9ICdmdW5jdGlvbicgJiYgdGhpc0FyZyAmJiB0aGlzQXJnW2lzU2hhbGxvd10gPT09IGFycmF5KSA/IG51bGwgOiBpc1NoYWxsb3c7XG4gICAgICAgIGlzU2hhbGxvdyA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGNhbGxiYWNrICE9IG51bGwpIHtcbiAgICAgICAgYXJyYXkgPSBtYXAoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBiYXNlRmxhdHRlbihhcnJheSwgaXNTaGFsbG93KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBpbmRleCBhdCB3aGljaCB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBgdmFsdWVgIGlzIGZvdW5kIHVzaW5nXG4gICAgICogc3RyaWN0IGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgdGhlIGFycmF5IGlzIGFscmVhZHkgc29ydGVkXG4gICAgICogcHJvdmlkaW5nIGB0cnVlYCBmb3IgYGZyb21JbmRleGAgd2lsbCBydW4gYSBmYXN0ZXIgYmluYXJ5IHNlYXJjaC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHNlYXJjaCBmb3IuXG4gICAgICogQHBhcmFtIHtib29sZWFufG51bWJlcn0gW2Zyb21JbmRleD0wXSBUaGUgaW5kZXggdG8gc2VhcmNoIGZyb20gb3IgYHRydWVgXG4gICAgICogIHRvIHBlcmZvcm0gYSBiaW5hcnkgc2VhcmNoIG9uIGEgc29ydGVkIGFycmF5LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBtYXRjaGVkIHZhbHVlIG9yIGAtMWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uaW5kZXhPZihbMSwgMiwgMywgMSwgMiwgM10sIDIpO1xuICAgICAqIC8vID0+IDFcbiAgICAgKlxuICAgICAqIF8uaW5kZXhPZihbMSwgMiwgMywgMSwgMiwgM10sIDIsIDMpO1xuICAgICAqIC8vID0+IDRcbiAgICAgKlxuICAgICAqIF8uaW5kZXhPZihbMSwgMSwgMiwgMiwgMywgM10sIDIsIHRydWUpO1xuICAgICAqIC8vID0+IDJcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpbmRleE9mKGFycmF5LCB2YWx1ZSwgZnJvbUluZGV4KSB7XG4gICAgICBpZiAodHlwZW9mIGZyb21JbmRleCA9PSAnbnVtYmVyJykge1xuICAgICAgICB2YXIgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xuICAgICAgICBmcm9tSW5kZXggPSAoZnJvbUluZGV4IDwgMCA/IG5hdGl2ZU1heCgwLCBsZW5ndGggKyBmcm9tSW5kZXgpIDogZnJvbUluZGV4IHx8IDApO1xuICAgICAgfSBlbHNlIGlmIChmcm9tSW5kZXgpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gc29ydGVkSW5kZXgoYXJyYXksIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIGFycmF5W2luZGV4XSA9PT0gdmFsdWUgPyBpbmRleCA6IC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGJhc2VJbmRleE9mKGFycmF5LCB2YWx1ZSwgZnJvbUluZGV4KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGFsbCBidXQgdGhlIGxhc3QgZWxlbWVudCBvciBsYXN0IGBuYCBlbGVtZW50cyBvZiBhbiBhcnJheS4gSWYgYVxuICAgICAqIGNhbGxiYWNrIGlzIHByb3ZpZGVkIGVsZW1lbnRzIGF0IHRoZSBlbmQgb2YgdGhlIGFycmF5IGFyZSBleGNsdWRlZCBmcm9tXG4gICAgICogdGhlIHJlc3VsdCBhcyBsb25nIGFzIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWV5LiBUaGUgY2FsbGJhY2sgaXMgYm91bmRcbiAgICAgKiB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBxdWVyeS5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxudW1iZXJ8c3RyaW5nfSBbY2FsbGJhY2s9MV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgICAqICBwZXIgZWxlbWVudCBvciB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIGV4Y2x1ZGUuIElmIGEgcHJvcGVydHkgbmFtZSBvclxuICAgICAqICBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiXG4gICAgICogIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgc2xpY2Ugb2YgYGFycmF5YC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5pbml0aWFsKFsxLCAyLCAzXSk7XG4gICAgICogLy8gPT4gWzEsIDJdXG4gICAgICpcbiAgICAgKiBfLmluaXRpYWwoWzEsIDIsIDNdLCAyKTtcbiAgICAgKiAvLyA9PiBbMV1cbiAgICAgKlxuICAgICAqIF8uaW5pdGlhbChbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkge1xuICAgICAqICAgcmV0dXJuIG51bSA+IDE7XG4gICAgICogfSk7XG4gICAgICogLy8gPT4gWzFdXG4gICAgICpcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgICdibG9ja2VkJzogZmFsc2UsICdlbXBsb3llcic6ICdzbGF0ZScgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgICdibG9ja2VkJzogdHJ1ZSwgICdlbXBsb3llcic6ICdzbGF0ZScgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAncGViYmxlcycsICdibG9ja2VkJzogdHJ1ZSwgICdlbXBsb3llcic6ICduYScgfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLmluaXRpYWwoY2hhcmFjdGVycywgJ2Jsb2NrZWQnKTtcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdiYXJuZXknLCAgJ2Jsb2NrZWQnOiBmYWxzZSwgJ2VtcGxveWVyJzogJ3NsYXRlJyB9XVxuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5wbHVjayhfLmluaXRpYWwoY2hhcmFjdGVycywgeyAnZW1wbG95ZXInOiAnbmEnIH0pLCAnbmFtZScpO1xuICAgICAqIC8vID0+IFsnYmFybmV5JywgJ2ZyZWQnXVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGluaXRpYWwoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgbiA9IDAsXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xuXG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdudW1iZXInICYmIGNhbGxiYWNrICE9IG51bGwpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gbGVuZ3RoO1xuICAgICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XG4gICAgICAgIHdoaWxlIChpbmRleC0tICYmIGNhbGxiYWNrKGFycmF5W2luZGV4XSwgaW5kZXgsIGFycmF5KSkge1xuICAgICAgICAgIG4rKztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbiA9IChjYWxsYmFjayA9PSBudWxsIHx8IHRoaXNBcmcpID8gMSA6IGNhbGxiYWNrIHx8IG47XG4gICAgICB9XG4gICAgICByZXR1cm4gc2xpY2UoYXJyYXksIDAsIG5hdGl2ZU1pbihuYXRpdmVNYXgoMCwgbGVuZ3RoIC0gbiksIGxlbmd0aCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgdW5pcXVlIHZhbHVlcyBwcmVzZW50IGluIGFsbCBwcm92aWRlZCBhcnJheXMgdXNpbmdcbiAgICAgKiBzdHJpY3QgZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7Li4uQXJyYXl9IFthcnJheV0gVGhlIGFycmF5cyB0byBpbnNwZWN0LlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiBzaGFyZWQgdmFsdWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmludGVyc2VjdGlvbihbMSwgMiwgM10sIFs1LCAyLCAxLCA0XSwgWzIsIDFdKTtcbiAgICAgKiAvLyA9PiBbMSwgMl1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpbnRlcnNlY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IFtdLFxuICAgICAgICAgIGFyZ3NJbmRleCA9IC0xLFxuICAgICAgICAgIGFyZ3NMZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICAgIGNhY2hlcyA9IGdldEFycmF5KCksXG4gICAgICAgICAgaW5kZXhPZiA9IGdldEluZGV4T2YoKSxcbiAgICAgICAgICB0cnVzdEluZGV4T2YgPSBpbmRleE9mID09PSBiYXNlSW5kZXhPZixcbiAgICAgICAgICBzZWVuID0gZ2V0QXJyYXkoKTtcblxuICAgICAgd2hpbGUgKCsrYXJnc0luZGV4IDwgYXJnc0xlbmd0aCkge1xuICAgICAgICB2YXIgdmFsdWUgPSBhcmd1bWVudHNbYXJnc0luZGV4XTtcbiAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpIHx8IGlzQXJndW1lbnRzKHZhbHVlKSkge1xuICAgICAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgY2FjaGVzLnB1c2godHJ1c3RJbmRleE9mICYmIHZhbHVlLmxlbmd0aCA+PSBsYXJnZUFycmF5U2l6ZSAmJlxuICAgICAgICAgICAgY3JlYXRlQ2FjaGUoYXJnc0luZGV4ID8gYXJnc1thcmdzSW5kZXhdIDogc2VlbikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB2YXIgYXJyYXkgPSBhcmdzWzBdLFxuICAgICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxuICAgICAgICAgIHJlc3VsdCA9IFtdO1xuXG4gICAgICBvdXRlcjpcbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIHZhciBjYWNoZSA9IGNhY2hlc1swXTtcbiAgICAgICAgdmFsdWUgPSBhcnJheVtpbmRleF07XG5cbiAgICAgICAgaWYgKChjYWNoZSA/IGNhY2hlSW5kZXhPZihjYWNoZSwgdmFsdWUpIDogaW5kZXhPZihzZWVuLCB2YWx1ZSkpIDwgMCkge1xuICAgICAgICAgIGFyZ3NJbmRleCA9IGFyZ3NMZW5ndGg7XG4gICAgICAgICAgKGNhY2hlIHx8IHNlZW4pLnB1c2godmFsdWUpO1xuICAgICAgICAgIHdoaWxlICgtLWFyZ3NJbmRleCkge1xuICAgICAgICAgICAgY2FjaGUgPSBjYWNoZXNbYXJnc0luZGV4XTtcbiAgICAgICAgICAgIGlmICgoY2FjaGUgPyBjYWNoZUluZGV4T2YoY2FjaGUsIHZhbHVlKSA6IGluZGV4T2YoYXJnc1thcmdzSW5kZXhdLCB2YWx1ZSkpIDwgMCkge1xuICAgICAgICAgICAgICBjb250aW51ZSBvdXRlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB3aGlsZSAoYXJnc0xlbmd0aC0tKSB7XG4gICAgICAgIGNhY2hlID0gY2FjaGVzW2FyZ3NMZW5ndGhdO1xuICAgICAgICBpZiAoY2FjaGUpIHtcbiAgICAgICAgICByZWxlYXNlT2JqZWN0KGNhY2hlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmVsZWFzZUFycmF5KGNhY2hlcyk7XG4gICAgICByZWxlYXNlQXJyYXkoc2Vlbik7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGxhc3QgZWxlbWVudCBvciBsYXN0IGBuYCBlbGVtZW50cyBvZiBhbiBhcnJheS4gSWYgYSBjYWxsYmFjayBpc1xuICAgICAqIHByb3ZpZGVkIGVsZW1lbnRzIGF0IHRoZSBlbmQgb2YgdGhlIGFycmF5IGFyZSByZXR1cm5lZCBhcyBsb25nIGFzIHRoZVxuICAgICAqIGNhbGxiYWNrIHJldHVybnMgdHJ1ZXkuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWRcbiAgICAgKiB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleCwgYXJyYXkpLlxuICAgICAqXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxuICAgICAqXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcbiAgICAgKiBlbHNlIGBmYWxzZWAuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHF1ZXJ5LlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fG51bWJlcnxzdHJpbmd9IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgICAqICBwZXIgZWxlbWVudCBvciB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIHJldHVybi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yXG4gICAgICogIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCJcbiAgICAgKiAgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgbGFzdCBlbGVtZW50KHMpIG9mIGBhcnJheWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8ubGFzdChbMSwgMiwgM10pO1xuICAgICAqIC8vID0+IDNcbiAgICAgKlxuICAgICAqIF8ubGFzdChbMSwgMiwgM10sIDIpO1xuICAgICAqIC8vID0+IFsyLCAzXVxuICAgICAqXG4gICAgICogXy5sYXN0KFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7XG4gICAgICogICByZXR1cm4gbnVtID4gMTtcbiAgICAgKiB9KTtcbiAgICAgKiAvLyA9PiBbMiwgM11cbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAgJ2Jsb2NrZWQnOiBmYWxzZSwgJ2VtcGxveWVyJzogJ3NsYXRlJyB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAgJ2Jsb2NrZWQnOiB0cnVlLCAgJ2VtcGxveWVyJzogJ3NsYXRlJyB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdwZWJibGVzJywgJ2Jsb2NrZWQnOiB0cnVlLCAgJ2VtcGxveWVyJzogJ25hJyB9XG4gICAgICogXTtcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8ucGx1Y2soXy5sYXN0KGNoYXJhY3RlcnMsICdibG9ja2VkJyksICduYW1lJyk7XG4gICAgICogLy8gPT4gWydmcmVkJywgJ3BlYmJsZXMnXVxuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy5sYXN0KGNoYXJhY3RlcnMsIHsgJ2VtcGxveWVyJzogJ25hJyB9KTtcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdwZWJibGVzJywgJ2Jsb2NrZWQnOiB0cnVlLCAnZW1wbG95ZXInOiAnbmEnIH1dXG4gICAgICovXG4gICAgZnVuY3Rpb24gbGFzdChhcnJheSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIHZhciBuID0gMCxcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XG5cbiAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ251bWJlcicgJiYgY2FsbGJhY2sgIT0gbnVsbCkge1xuICAgICAgICB2YXIgaW5kZXggPSBsZW5ndGg7XG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcbiAgICAgICAgd2hpbGUgKGluZGV4LS0gJiYgY2FsbGJhY2soYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpKSB7XG4gICAgICAgICAgbisrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuID0gY2FsbGJhY2s7XG4gICAgICAgIGlmIChuID09IG51bGwgfHwgdGhpc0FyZykge1xuICAgICAgICAgIHJldHVybiBhcnJheSA/IGFycmF5W2xlbmd0aCAtIDFdIDogdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gc2xpY2UoYXJyYXksIG5hdGl2ZU1heCgwLCBsZW5ndGggLSBuKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgaW5kZXggYXQgd2hpY2ggdGhlIGxhc3Qgb2NjdXJyZW5jZSBvZiBgdmFsdWVgIGlzIGZvdW5kIHVzaW5nIHN0cmljdFxuICAgICAqIGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgYGZyb21JbmRleGAgaXMgbmVnYXRpdmUsIGl0IGlzIHVzZWRcbiAgICAgKiBhcyB0aGUgb2Zmc2V0IGZyb20gdGhlIGVuZCBvZiB0aGUgY29sbGVjdGlvbi5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VhcmNoIGZvci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2Zyb21JbmRleD1hcnJheS5sZW5ndGgtMV0gVGhlIGluZGV4IHRvIHNlYXJjaCBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBtYXRjaGVkIHZhbHVlIG9yIGAtMWAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8ubGFzdEluZGV4T2YoWzEsIDIsIDMsIDEsIDIsIDNdLCAyKTtcbiAgICAgKiAvLyA9PiA0XG4gICAgICpcbiAgICAgKiBfLmxhc3RJbmRleE9mKFsxLCAyLCAzLCAxLCAyLCAzXSwgMiwgMyk7XG4gICAgICogLy8gPT4gMVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGxhc3RJbmRleE9mKGFycmF5LCB2YWx1ZSwgZnJvbUluZGV4KSB7XG4gICAgICB2YXIgaW5kZXggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XG4gICAgICBpZiAodHlwZW9mIGZyb21JbmRleCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpbmRleCA9IChmcm9tSW5kZXggPCAwID8gbmF0aXZlTWF4KDAsIGluZGV4ICsgZnJvbUluZGV4KSA6IG5hdGl2ZU1pbihmcm9tSW5kZXgsIGluZGV4IC0gMSkpICsgMTtcbiAgICAgIH1cbiAgICAgIHdoaWxlIChpbmRleC0tKSB7XG4gICAgICAgIGlmIChhcnJheVtpbmRleF0gPT09IHZhbHVlKSB7XG4gICAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbGwgcHJvdmlkZWQgdmFsdWVzIGZyb20gdGhlIGdpdmVuIGFycmF5IHVzaW5nIHN0cmljdCBlcXVhbGl0eSBmb3JcbiAgICAgKiBjb21wYXJpc29ucywgaS5lLiBgPT09YC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gbW9kaWZ5LlxuICAgICAqIEBwYXJhbSB7Li4uKn0gW3ZhbHVlXSBUaGUgdmFsdWVzIHRvIHJlbW92ZS5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYGFycmF5YC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGFycmF5ID0gWzEsIDIsIDMsIDEsIDIsIDNdO1xuICAgICAqIF8ucHVsbChhcnJheSwgMiwgMyk7XG4gICAgICogY29uc29sZS5sb2coYXJyYXkpO1xuICAgICAqIC8vID0+IFsxLCAxXVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHB1bGwoYXJyYXkpIHtcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICAgIGFyZ3NJbmRleCA9IDAsXG4gICAgICAgICAgYXJnc0xlbmd0aCA9IGFyZ3MubGVuZ3RoLFxuICAgICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMDtcblxuICAgICAgd2hpbGUgKCsrYXJnc0luZGV4IDwgYXJnc0xlbmd0aCkge1xuICAgICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICAgIHZhbHVlID0gYXJnc1thcmdzSW5kZXhdO1xuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgIGlmIChhcnJheVtpbmRleF0gPT09IHZhbHVlKSB7XG4gICAgICAgICAgICBzcGxpY2UuY2FsbChhcnJheSwgaW5kZXgtLSwgMSk7XG4gICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBhcnJheTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIG51bWJlcnMgKHBvc2l0aXZlIGFuZC9vciBuZWdhdGl2ZSkgcHJvZ3Jlc3NpbmcgZnJvbVxuICAgICAqIGBzdGFydGAgdXAgdG8gYnV0IG5vdCBpbmNsdWRpbmcgYGVuZGAuIElmIGBzdGFydGAgaXMgbGVzcyB0aGFuIGBzdG9wYCBhXG4gICAgICogemVyby1sZW5ndGggcmFuZ2UgaXMgY3JlYXRlZCB1bmxlc3MgYSBuZWdhdGl2ZSBgc3RlcGAgaXMgc3BlY2lmaWVkLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbc3RhcnQ9MF0gVGhlIHN0YXJ0IG9mIHRoZSByYW5nZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZW5kIFRoZSBlbmQgb2YgdGhlIHJhbmdlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbc3RlcD0xXSBUaGUgdmFsdWUgdG8gaW5jcmVtZW50IG9yIGRlY3JlbWVudCBieS5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgcmFuZ2UgYXJyYXkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8ucmFuZ2UoNCk7XG4gICAgICogLy8gPT4gWzAsIDEsIDIsIDNdXG4gICAgICpcbiAgICAgKiBfLnJhbmdlKDEsIDUpO1xuICAgICAqIC8vID0+IFsxLCAyLCAzLCA0XVxuICAgICAqXG4gICAgICogXy5yYW5nZSgwLCAyMCwgNSk7XG4gICAgICogLy8gPT4gWzAsIDUsIDEwLCAxNV1cbiAgICAgKlxuICAgICAqIF8ucmFuZ2UoMCwgLTQsIC0xKTtcbiAgICAgKiAvLyA9PiBbMCwgLTEsIC0yLCAtM11cbiAgICAgKlxuICAgICAqIF8ucmFuZ2UoMSwgNCwgMCk7XG4gICAgICogLy8gPT4gWzEsIDEsIDFdXG4gICAgICpcbiAgICAgKiBfLnJhbmdlKDApO1xuICAgICAqIC8vID0+IFtdXG4gICAgICovXG4gICAgZnVuY3Rpb24gcmFuZ2Uoc3RhcnQsIGVuZCwgc3RlcCkge1xuICAgICAgc3RhcnQgPSArc3RhcnQgfHwgMDtcbiAgICAgIHN0ZXAgPSB0eXBlb2Ygc3RlcCA9PSAnbnVtYmVyJyA/IHN0ZXAgOiAoK3N0ZXAgfHwgMSk7XG5cbiAgICAgIGlmIChlbmQgPT0gbnVsbCkge1xuICAgICAgICBlbmQgPSBzdGFydDtcbiAgICAgICAgc3RhcnQgPSAwO1xuICAgICAgfVxuICAgICAgLy8gdXNlIGBBcnJheShsZW5ndGgpYCBzbyBlbmdpbmVzIGxpa2UgQ2hha3JhIGFuZCBWOCBhdm9pZCBzbG93ZXIgbW9kZXNcbiAgICAgIC8vIGh0dHA6Ly95b3V0dS5iZS9YQXFJcEdVOFpaayN0PTE3bTI1c1xuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gbmF0aXZlTWF4KDAsIGNlaWwoKGVuZCAtIHN0YXJ0KSAvIChzdGVwIHx8IDEpKSksXG4gICAgICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IHN0YXJ0O1xuICAgICAgICBzdGFydCArPSBzdGVwO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBlbGVtZW50cyBmcm9tIGFuIGFycmF5IHRoYXQgdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZXkgZm9yXG4gICAgICogYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgcmVtb3ZlZCBlbGVtZW50cy4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYFxuICAgICAqIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBhcnJheSkuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gbW9kaWZ5LlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXG4gICAgICogIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHJlbW92ZWQgZWxlbWVudHMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBhcnJheSA9IFsxLCAyLCAzLCA0LCA1LCA2XTtcbiAgICAgKiB2YXIgZXZlbnMgPSBfLnJlbW92ZShhcnJheSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gJSAyID09IDA7IH0pO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coYXJyYXkpO1xuICAgICAqIC8vID0+IFsxLCAzLCA1XVxuICAgICAqXG4gICAgICogY29uc29sZS5sb2coZXZlbnMpO1xuICAgICAqIC8vID0+IFsyLCA0LCA2XVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlbW92ZShhcnJheSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMCxcbiAgICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gYXJyYXlbaW5kZXhdO1xuICAgICAgICBpZiAoY2FsbGJhY2sodmFsdWUsIGluZGV4LCBhcnJheSkpIHtcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgc3BsaWNlLmNhbGwoYXJyYXksIGluZGV4LS0sIDEpO1xuICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBvcHBvc2l0ZSBvZiBgXy5pbml0aWFsYCB0aGlzIG1ldGhvZCBnZXRzIGFsbCBidXQgdGhlIGZpcnN0IGVsZW1lbnQgb3JcbiAgICAgKiBmaXJzdCBgbmAgZWxlbWVudHMgb2YgYW4gYXJyYXkuIElmIGEgY2FsbGJhY2sgZnVuY3Rpb24gaXMgcHJvdmlkZWQgZWxlbWVudHNcbiAgICAgKiBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhcnJheSBhcmUgZXhjbHVkZWQgZnJvbSB0aGUgcmVzdWx0IGFzIGxvbmcgYXMgdGhlXG4gICAgICogY2FsbGJhY2sgcmV0dXJucyB0cnVleS4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZFxuICAgICAqIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBhcnJheSkuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBhbGlhcyBkcm9wLCB0YWlsXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBxdWVyeS5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxudW1iZXJ8c3RyaW5nfSBbY2FsbGJhY2s9MV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgICAqICBwZXIgZWxlbWVudCBvciB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIGV4Y2x1ZGUuIElmIGEgcHJvcGVydHkgbmFtZSBvclxuICAgICAqICBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiXG4gICAgICogIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgc2xpY2Ugb2YgYGFycmF5YC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5yZXN0KFsxLCAyLCAzXSk7XG4gICAgICogLy8gPT4gWzIsIDNdXG4gICAgICpcbiAgICAgKiBfLnJlc3QoWzEsIDIsIDNdLCAyKTtcbiAgICAgKiAvLyA9PiBbM11cbiAgICAgKlxuICAgICAqIF8ucmVzdChbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkge1xuICAgICAqICAgcmV0dXJuIG51bSA8IDM7XG4gICAgICogfSk7XG4gICAgICogLy8gPT4gWzNdXG4gICAgICpcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgICdibG9ja2VkJzogdHJ1ZSwgICdlbXBsb3llcic6ICdzbGF0ZScgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgICdibG9ja2VkJzogZmFsc2UsICAnZW1wbG95ZXInOiAnc2xhdGUnIH0sXG4gICAgICogICB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYmxvY2tlZCc6IHRydWUsICdlbXBsb3llcic6ICduYScgfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICAgKiBfLnBsdWNrKF8ucmVzdChjaGFyYWN0ZXJzLCAnYmxvY2tlZCcpLCAnbmFtZScpO1xuICAgICAqIC8vID0+IFsnZnJlZCcsICdwZWJibGVzJ11cbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy53aGVyZVwiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8ucmVzdChjaGFyYWN0ZXJzLCB7ICdlbXBsb3llcic6ICdzbGF0ZScgfSk7XG4gICAgICogLy8gPT4gW3sgJ25hbWUnOiAncGViYmxlcycsICdibG9ja2VkJzogdHJ1ZSwgJ2VtcGxveWVyJzogJ25hJyB9XVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlc3QoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdudW1iZXInICYmIGNhbGxiYWNrICE9IG51bGwpIHtcbiAgICAgICAgdmFyIG4gPSAwLFxuICAgICAgICAgICAgaW5kZXggPSAtMSxcbiAgICAgICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMDtcblxuICAgICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XG4gICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoICYmIGNhbGxiYWNrKGFycmF5W2luZGV4XSwgaW5kZXgsIGFycmF5KSkge1xuICAgICAgICAgIG4rKztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbiA9IChjYWxsYmFjayA9PSBudWxsIHx8IHRoaXNBcmcpID8gMSA6IG5hdGl2ZU1heCgwLCBjYWxsYmFjayk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2xpY2UoYXJyYXksIG4pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVzZXMgYSBiaW5hcnkgc2VhcmNoIHRvIGRldGVybWluZSB0aGUgc21hbGxlc3QgaW5kZXggYXQgd2hpY2ggYSB2YWx1ZVxuICAgICAqIHNob3VsZCBiZSBpbnNlcnRlZCBpbnRvIGEgZ2l2ZW4gc29ydGVkIGFycmF5IGluIG9yZGVyIHRvIG1haW50YWluIHRoZSBzb3J0XG4gICAgICogb3JkZXIgb2YgdGhlIGFycmF5LiBJZiBhIGNhbGxiYWNrIGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgZXhlY3V0ZWQgZm9yXG4gICAgICogYHZhbHVlYCBhbmQgZWFjaCBlbGVtZW50IG9mIGBhcnJheWAgdG8gY29tcHV0ZSB0aGVpciBzb3J0IHJhbmtpbmcuIFRoZVxuICAgICAqIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIG9uZSBhcmd1bWVudDsgKHZhbHVlKS5cbiAgICAgKlxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAgICogZWxzZSBgZmFsc2VgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBpbnNwZWN0LlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGV2YWx1YXRlLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXG4gICAgICogIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgaW5kZXggYXQgd2hpY2ggYHZhbHVlYCBzaG91bGQgYmUgaW5zZXJ0ZWRcbiAgICAgKiAgaW50byBgYXJyYXlgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLnNvcnRlZEluZGV4KFsyMCwgMzAsIDUwXSwgNDApO1xuICAgICAqIC8vID0+IDJcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgICAqIF8uc29ydGVkSW5kZXgoW3sgJ3gnOiAyMCB9LCB7ICd4JzogMzAgfSwgeyAneCc6IDUwIH1dLCB7ICd4JzogNDAgfSwgJ3gnKTtcbiAgICAgKiAvLyA9PiAyXG4gICAgICpcbiAgICAgKiB2YXIgZGljdCA9IHtcbiAgICAgKiAgICd3b3JkVG9OdW1iZXInOiB7ICd0d2VudHknOiAyMCwgJ3RoaXJ0eSc6IDMwLCAnZm91cnR5JzogNDAsICdmaWZ0eSc6IDUwIH1cbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogXy5zb3J0ZWRJbmRleChbJ3R3ZW50eScsICd0aGlydHknLCAnZmlmdHknXSwgJ2ZvdXJ0eScsIGZ1bmN0aW9uKHdvcmQpIHtcbiAgICAgKiAgIHJldHVybiBkaWN0LndvcmRUb051bWJlclt3b3JkXTtcbiAgICAgKiB9KTtcbiAgICAgKiAvLyA9PiAyXG4gICAgICpcbiAgICAgKiBfLnNvcnRlZEluZGV4KFsndHdlbnR5JywgJ3RoaXJ0eScsICdmaWZ0eSddLCAnZm91cnR5JywgZnVuY3Rpb24od29yZCkge1xuICAgICAqICAgcmV0dXJuIHRoaXMud29yZFRvTnVtYmVyW3dvcmRdO1xuICAgICAqIH0sIGRpY3QpO1xuICAgICAqIC8vID0+IDJcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzb3J0ZWRJbmRleChhcnJheSwgdmFsdWUsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICB2YXIgbG93ID0gMCxcbiAgICAgICAgICBoaWdoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiBsb3c7XG5cbiAgICAgIC8vIGV4cGxpY2l0bHkgcmVmZXJlbmNlIGBpZGVudGl0eWAgZm9yIGJldHRlciBpbmxpbmluZyBpbiBGaXJlZm94XG4gICAgICBjYWxsYmFjayA9IGNhbGxiYWNrID8gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAxKSA6IGlkZW50aXR5O1xuICAgICAgdmFsdWUgPSBjYWxsYmFjayh2YWx1ZSk7XG5cbiAgICAgIHdoaWxlIChsb3cgPCBoaWdoKSB7XG4gICAgICAgIHZhciBtaWQgPSAobG93ICsgaGlnaCkgPj4+IDE7XG4gICAgICAgIChjYWxsYmFjayhhcnJheVttaWRdKSA8IHZhbHVlKVxuICAgICAgICAgID8gbG93ID0gbWlkICsgMVxuICAgICAgICAgIDogaGlnaCA9IG1pZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBsb3c7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiB1bmlxdWUgdmFsdWVzLCBpbiBvcmRlciwgb2YgdGhlIHByb3ZpZGVkIGFycmF5cyB1c2luZ1xuICAgICAqIHN0cmljdCBlcXVhbGl0eSBmb3IgY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAgICogQHBhcmFtIHsuLi5BcnJheX0gW2FycmF5XSBUaGUgYXJyYXlzIHRvIGluc3BlY3QuXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGFuIGFycmF5IG9mIGNvbWJpbmVkIHZhbHVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy51bmlvbihbMSwgMiwgM10sIFs1LCAyLCAxLCA0XSwgWzIsIDFdKTtcbiAgICAgKiAvLyA9PiBbMSwgMiwgMywgNSwgNF1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB1bmlvbigpIHtcbiAgICAgIHJldHVybiBiYXNlVW5pcShiYXNlRmxhdHRlbihhcmd1bWVudHMsIHRydWUsIHRydWUpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZHVwbGljYXRlLXZhbHVlLWZyZWUgdmVyc2lvbiBvZiBhbiBhcnJheSB1c2luZyBzdHJpY3QgZXF1YWxpdHlcbiAgICAgKiBmb3IgY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuIElmIHRoZSBhcnJheSBpcyBzb3J0ZWQsIHByb3ZpZGluZ1xuICAgICAqIGB0cnVlYCBmb3IgYGlzU29ydGVkYCB3aWxsIHVzZSBhIGZhc3RlciBhbGdvcml0aG0uIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWRcbiAgICAgKiBlYWNoIGVsZW1lbnQgb2YgYGFycmF5YCBpcyBwYXNzZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgYmVmb3JlIHVuaXF1ZW5lc3NcbiAgICAgKiBpcyBjb21wdXRlZC4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlXG4gICAgICogYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBhcnJheSkuXG4gICAgICpcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgICAqIGVsc2UgYGZhbHNlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBhbGlhcyB1bmlxdWVcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHByb2Nlc3MuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbaXNTb3J0ZWQ9ZmFsc2VdIEEgZmxhZyB0byBpbmRpY2F0ZSB0aGF0IGBhcnJheWAgaXMgc29ydGVkLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXG4gICAgICogIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgZHVwbGljYXRlLXZhbHVlLWZyZWUgYXJyYXkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8udW5pcShbMSwgMiwgMSwgMywgMV0pO1xuICAgICAqIC8vID0+IFsxLCAyLCAzXVxuICAgICAqXG4gICAgICogXy51bmlxKFsxLCAxLCAyLCAyLCAzXSwgdHJ1ZSk7XG4gICAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAgICpcbiAgICAgKiBfLnVuaXEoWydBJywgJ2InLCAnQycsICdhJywgJ0InLCAnYyddLCBmdW5jdGlvbihsZXR0ZXIpIHsgcmV0dXJuIGxldHRlci50b0xvd2VyQ2FzZSgpOyB9KTtcbiAgICAgKiAvLyA9PiBbJ0EnLCAnYicsICdDJ11cbiAgICAgKlxuICAgICAqIF8udW5pcShbMSwgMi41LCAzLCAxLjUsIDIsIDMuNV0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gdGhpcy5mbG9vcihudW0pOyB9LCBNYXRoKTtcbiAgICAgKiAvLyA9PiBbMSwgMi41LCAzXVxuICAgICAqXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAgICogXy51bmlxKFt7ICd4JzogMSB9LCB7ICd4JzogMiB9LCB7ICd4JzogMSB9XSwgJ3gnKTtcbiAgICAgKiAvLyA9PiBbeyAneCc6IDEgfSwgeyAneCc6IDIgfV1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB1bmlxKGFycmF5LCBpc1NvcnRlZCwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIC8vIGp1Z2dsZSBhcmd1bWVudHNcbiAgICAgIGlmICh0eXBlb2YgaXNTb3J0ZWQgIT0gJ2Jvb2xlYW4nICYmIGlzU29ydGVkICE9IG51bGwpIHtcbiAgICAgICAgdGhpc0FyZyA9IGNhbGxiYWNrO1xuICAgICAgICBjYWxsYmFjayA9ICh0eXBlb2YgaXNTb3J0ZWQgIT0gJ2Z1bmN0aW9uJyAmJiB0aGlzQXJnICYmIHRoaXNBcmdbaXNTb3J0ZWRdID09PSBhcnJheSkgPyBudWxsIDogaXNTb3J0ZWQ7XG4gICAgICAgIGlzU29ydGVkID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoY2FsbGJhY2sgIT0gbnVsbCkge1xuICAgICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYmFzZVVuaXEoYXJyYXksIGlzU29ydGVkLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSBleGNsdWRpbmcgYWxsIHByb3ZpZGVkIHZhbHVlcyB1c2luZyBzdHJpY3QgZXF1YWxpdHkgZm9yXG4gICAgICogY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGZpbHRlci5cbiAgICAgKiBAcGFyYW0gey4uLip9IFt2YWx1ZV0gVGhlIHZhbHVlcyB0byBleGNsdWRlLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBmaWx0ZXJlZCB2YWx1ZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8ud2l0aG91dChbMSwgMiwgMSwgMCwgMywgMSwgNF0sIDAsIDEpO1xuICAgICAqIC8vID0+IFsyLCAzLCA0XVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHdpdGhvdXQoYXJyYXkpIHtcbiAgICAgIHJldHVybiBiYXNlRGlmZmVyZW5jZShhcnJheSwgc2xpY2UoYXJndW1lbnRzLCAxKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSB0aGF0IGlzIHRoZSBzeW1tZXRyaWMgZGlmZmVyZW5jZSBvZiB0aGUgcHJvdmlkZWQgYXJyYXlzLlxuICAgICAqIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1N5bW1ldHJpY19kaWZmZXJlbmNlLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgICAqIEBwYXJhbSB7Li4uQXJyYXl9IFthcnJheV0gVGhlIGFycmF5cyB0byBpbnNwZWN0LlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiB2YWx1ZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8ueG9yKFsxLCAyLCAzXSwgWzUsIDIsIDEsIDRdKTtcbiAgICAgKiAvLyA9PiBbMywgNSwgNF1cbiAgICAgKlxuICAgICAqIF8ueG9yKFsxLCAyLCA1XSwgWzIsIDMsIDVdLCBbMywgNCwgNV0pO1xuICAgICAqIC8vID0+IFsxLCA0LCA1XVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHhvcigpIHtcbiAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7XG5cbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIHZhciBhcnJheSA9IGFyZ3VtZW50c1tpbmRleF07XG4gICAgICAgIGlmIChpc0FycmF5KGFycmF5KSB8fCBpc0FyZ3VtZW50cyhhcnJheSkpIHtcbiAgICAgICAgICB2YXIgcmVzdWx0ID0gcmVzdWx0XG4gICAgICAgICAgICA/IGJhc2VVbmlxKGJhc2VEaWZmZXJlbmNlKHJlc3VsdCwgYXJyYXkpLmNvbmNhdChiYXNlRGlmZmVyZW5jZShhcnJheSwgcmVzdWx0KSkpXG4gICAgICAgICAgICA6IGFycmF5O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0IHx8IFtdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgZ3JvdXBlZCBlbGVtZW50cywgdGhlIGZpcnN0IG9mIHdoaWNoIGNvbnRhaW5zIHRoZSBmaXJzdFxuICAgICAqIGVsZW1lbnRzIG9mIHRoZSBnaXZlbiBhcnJheXMsIHRoZSBzZWNvbmQgb2Ygd2hpY2ggY29udGFpbnMgdGhlIHNlY29uZFxuICAgICAqIGVsZW1lbnRzIG9mIHRoZSBnaXZlbiBhcnJheXMsIGFuZCBzbyBvbi5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBhbGlhcyB1bnppcFxuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICAgKiBAcGFyYW0gey4uLkFycmF5fSBbYXJyYXldIEFycmF5cyB0byBwcm9jZXNzLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBncm91cGVkIGVsZW1lbnRzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLnppcChbJ2ZyZWQnLCAnYmFybmV5J10sIFszMCwgNDBdLCBbdHJ1ZSwgZmFsc2VdKTtcbiAgICAgKiAvLyA9PiBbWydmcmVkJywgMzAsIHRydWVdLCBbJ2Jhcm5leScsIDQwLCBmYWxzZV1dXG4gICAgICovXG4gICAgZnVuY3Rpb24gemlwKCkge1xuICAgICAgdmFyIGFycmF5ID0gYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHMgOiBhcmd1bWVudHNbMF0sXG4gICAgICAgICAgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IG1heChwbHVjayhhcnJheSwgJ2xlbmd0aCcpKSA6IDAsXG4gICAgICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoIDwgMCA/IDAgOiBsZW5ndGgpO1xuXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICByZXN1bHRbaW5kZXhdID0gcGx1Y2soYXJyYXksIGluZGV4KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBvYmplY3QgY29tcG9zZWQgZnJvbSBhcnJheXMgb2YgYGtleXNgIGFuZCBgdmFsdWVzYC4gUHJvdmlkZVxuICAgICAqIGVpdGhlciBhIHNpbmdsZSB0d28gZGltZW5zaW9uYWwgYXJyYXksIGkuZS4gYFtba2V5MSwgdmFsdWUxXSwgW2tleTIsIHZhbHVlMl1dYFxuICAgICAqIG9yIHR3byBhcnJheXMsIG9uZSBvZiBga2V5c2AgYW5kIG9uZSBvZiBjb3JyZXNwb25kaW5nIGB2YWx1ZXNgLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGFsaWFzIG9iamVjdFxuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBrZXlzIFRoZSBhcnJheSBvZiBrZXlzLlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IFt2YWx1ZXM9W11dIFRoZSBhcnJheSBvZiB2YWx1ZXMuXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBvYmplY3QgY29tcG9zZWQgb2YgdGhlIGdpdmVuIGtleXMgYW5kXG4gICAgICogIGNvcnJlc3BvbmRpbmcgdmFsdWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLnppcE9iamVjdChbJ2ZyZWQnLCAnYmFybmV5J10sIFszMCwgNDBdKTtcbiAgICAgKiAvLyA9PiB7ICdmcmVkJzogMzAsICdiYXJuZXknOiA0MCB9XG4gICAgICovXG4gICAgZnVuY3Rpb24gemlwT2JqZWN0KGtleXMsIHZhbHVlcykge1xuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0ga2V5cyA/IGtleXMubGVuZ3RoIDogMCxcbiAgICAgICAgICByZXN1bHQgPSB7fTtcblxuICAgICAgaWYgKCF2YWx1ZXMgJiYgbGVuZ3RoICYmICFpc0FycmF5KGtleXNbMF0pKSB7XG4gICAgICAgIHZhbHVlcyA9IFtdO1xuICAgICAgfVxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbaW5kZXhdO1xuICAgICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZXNbaW5kZXhdO1xuICAgICAgICB9IGVsc2UgaWYgKGtleSkge1xuICAgICAgICAgIHJlc3VsdFtrZXlbMF1dID0ga2V5WzFdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgZXhlY3V0ZXMgYGZ1bmNgLCB3aXRoICB0aGUgYHRoaXNgIGJpbmRpbmcgYW5kXG4gICAgICogYXJndW1lbnRzIG9mIHRoZSBjcmVhdGVkIGZ1bmN0aW9uLCBvbmx5IGFmdGVyIGJlaW5nIGNhbGxlZCBgbmAgdGltZXMuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gVGhlIG51bWJlciBvZiB0aW1lcyB0aGUgZnVuY3Rpb24gbXVzdCBiZSBjYWxsZWQgYmVmb3JlXG4gICAgICogIGBmdW5jYCBpcyBleGVjdXRlZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byByZXN0cmljdC5cbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyByZXN0cmljdGVkIGZ1bmN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgc2F2ZXMgPSBbJ3Byb2ZpbGUnLCAnc2V0dGluZ3MnXTtcbiAgICAgKlxuICAgICAqIHZhciBkb25lID0gXy5hZnRlcihzYXZlcy5sZW5ndGgsIGZ1bmN0aW9uKCkge1xuICAgICAqICAgY29uc29sZS5sb2coJ0RvbmUgc2F2aW5nIScpO1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogXy5mb3JFYWNoKHNhdmVzLCBmdW5jdGlvbih0eXBlKSB7XG4gICAgICogICBhc3luY1NhdmUoeyAndHlwZSc6IHR5cGUsICdjb21wbGV0ZSc6IGRvbmUgfSk7XG4gICAgICogfSk7XG4gICAgICogLy8gPT4gbG9ncyAnRG9uZSBzYXZpbmchJywgYWZ0ZXIgYWxsIHNhdmVzIGhhdmUgY29tcGxldGVkXG4gICAgICovXG4gICAgZnVuY3Rpb24gYWZ0ZXIobiwgZnVuYykge1xuICAgICAgaWYgKCFpc0Z1bmN0aW9uKGZ1bmMpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICgtLW4gPCAxKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsIGludm9rZXMgYGZ1bmNgIHdpdGggdGhlIGB0aGlzYFxuICAgICAqIGJpbmRpbmcgb2YgYHRoaXNBcmdgIGFuZCBwcmVwZW5kcyBhbnkgYWRkaXRpb25hbCBgYmluZGAgYXJndW1lbnRzIHRvIHRob3NlXG4gICAgICogcHJvdmlkZWQgdG8gdGhlIGJvdW5kIGZ1bmN0aW9uLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGJpbmQuXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAgICAgKiBAcGFyYW0gey4uLip9IFthcmddIEFyZ3VtZW50cyB0byBiZSBwYXJ0aWFsbHkgYXBwbGllZC5cbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBib3VuZCBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGZ1bmMgPSBmdW5jdGlvbihncmVldGluZykge1xuICAgICAqICAgcmV0dXJuIGdyZWV0aW5nICsgJyAnICsgdGhpcy5uYW1lO1xuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBmdW5jID0gXy5iaW5kKGZ1bmMsIHsgJ25hbWUnOiAnZnJlZCcgfSwgJ2hpJyk7XG4gICAgICogZnVuYygpO1xuICAgICAqIC8vID0+ICdoaSBmcmVkJ1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIGJpbmQoZnVuYywgdGhpc0FyZykge1xuICAgICAgcmV0dXJuIGFyZ3VtZW50cy5sZW5ndGggPiAyXG4gICAgICAgID8gY3JlYXRlV3JhcHBlcihmdW5jLCAxNywgc2xpY2UoYXJndW1lbnRzLCAyKSwgbnVsbCwgdGhpc0FyZylcbiAgICAgICAgOiBjcmVhdGVXcmFwcGVyKGZ1bmMsIDEsIG51bGwsIG51bGwsIHRoaXNBcmcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEJpbmRzIG1ldGhvZHMgb2YgYW4gb2JqZWN0IHRvIHRoZSBvYmplY3QgaXRzZWxmLCBvdmVyd3JpdGluZyB0aGUgZXhpc3RpbmdcbiAgICAgKiBtZXRob2QuIE1ldGhvZCBuYW1lcyBtYXkgYmUgc3BlY2lmaWVkIGFzIGluZGl2aWR1YWwgYXJndW1lbnRzIG9yIGFzIGFycmF5c1xuICAgICAqIG9mIG1ldGhvZCBuYW1lcy4gSWYgbm8gbWV0aG9kIG5hbWVzIGFyZSBwcm92aWRlZCBhbGwgdGhlIGZ1bmN0aW9uIHByb3BlcnRpZXNcbiAgICAgKiBvZiBgb2JqZWN0YCB3aWxsIGJlIGJvdW5kLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBiaW5kIGFuZCBhc3NpZ24gdGhlIGJvdW5kIG1ldGhvZHMgdG8uXG4gICAgICogQHBhcmFtIHsuLi5zdHJpbmd9IFttZXRob2ROYW1lXSBUaGUgb2JqZWN0IG1ldGhvZCBuYW1lcyB0b1xuICAgICAqICBiaW5kLCBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBtZXRob2QgbmFtZXMgb3IgYXJyYXlzIG9mIG1ldGhvZCBuYW1lcy5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgdmlldyA9IHtcbiAgICAgKiAgICdsYWJlbCc6ICdkb2NzJyxcbiAgICAgKiAgICdvbkNsaWNrJzogZnVuY3Rpb24oKSB7IGNvbnNvbGUubG9nKCdjbGlja2VkICcgKyB0aGlzLmxhYmVsKTsgfVxuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBfLmJpbmRBbGwodmlldyk7XG4gICAgICogalF1ZXJ5KCcjZG9jcycpLm9uKCdjbGljaycsIHZpZXcub25DbGljayk7XG4gICAgICogLy8gPT4gbG9ncyAnY2xpY2tlZCBkb2NzJywgd2hlbiB0aGUgYnV0dG9uIGlzIGNsaWNrZWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBiaW5kQWxsKG9iamVjdCkge1xuICAgICAgdmFyIGZ1bmNzID0gYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBiYXNlRmxhdHRlbihhcmd1bWVudHMsIHRydWUsIGZhbHNlLCAxKSA6IGZ1bmN0aW9ucyhvYmplY3QpLFxuICAgICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gZnVuY3MubGVuZ3RoO1xuXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICB2YXIga2V5ID0gZnVuY3NbaW5kZXhdO1xuICAgICAgICBvYmplY3Rba2V5XSA9IGNyZWF0ZVdyYXBwZXIob2JqZWN0W2tleV0sIDEsIG51bGwsIG51bGwsIG9iamVjdCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2JqZWN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCwgaW52b2tlcyB0aGUgbWV0aG9kIGF0IGBvYmplY3Rba2V5XWBcbiAgICAgKiBhbmQgcHJlcGVuZHMgYW55IGFkZGl0aW9uYWwgYGJpbmRLZXlgIGFyZ3VtZW50cyB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgYm91bmRcbiAgICAgKiBmdW5jdGlvbi4gVGhpcyBtZXRob2QgZGlmZmVycyBmcm9tIGBfLmJpbmRgIGJ5IGFsbG93aW5nIGJvdW5kIGZ1bmN0aW9ucyB0b1xuICAgICAqIHJlZmVyZW5jZSBtZXRob2RzIHRoYXQgd2lsbCBiZSByZWRlZmluZWQgb3IgZG9uJ3QgeWV0IGV4aXN0LlxuICAgICAqIFNlZSBodHRwOi8vbWljaGF1eC5jYS9hcnRpY2xlcy9sYXp5LWZ1bmN0aW9uLWRlZmluaXRpb24tcGF0dGVybi5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdGhlIG1ldGhvZCBiZWxvbmdzIHRvLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgbWV0aG9kLlxuICAgICAqIEBwYXJhbSB7Li4uKn0gW2FyZ10gQXJndW1lbnRzIHRvIGJlIHBhcnRpYWxseSBhcHBsaWVkLlxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGJvdW5kIGZ1bmN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgb2JqZWN0ID0ge1xuICAgICAqICAgJ25hbWUnOiAnZnJlZCcsXG4gICAgICogICAnZ3JlZXQnOiBmdW5jdGlvbihncmVldGluZykge1xuICAgICAqICAgICByZXR1cm4gZ3JlZXRpbmcgKyAnICcgKyB0aGlzLm5hbWU7XG4gICAgICogICB9XG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIHZhciBmdW5jID0gXy5iaW5kS2V5KG9iamVjdCwgJ2dyZWV0JywgJ2hpJyk7XG4gICAgICogZnVuYygpO1xuICAgICAqIC8vID0+ICdoaSBmcmVkJ1xuICAgICAqXG4gICAgICogb2JqZWN0LmdyZWV0ID0gZnVuY3Rpb24oZ3JlZXRpbmcpIHtcbiAgICAgKiAgIHJldHVybiBncmVldGluZyArICd5YSAnICsgdGhpcy5uYW1lICsgJyEnO1xuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBmdW5jKCk7XG4gICAgICogLy8gPT4gJ2hpeWEgZnJlZCEnXG4gICAgICovXG4gICAgZnVuY3Rpb24gYmluZEtleShvYmplY3QsIGtleSkge1xuICAgICAgcmV0dXJuIGFyZ3VtZW50cy5sZW5ndGggPiAyXG4gICAgICAgID8gY3JlYXRlV3JhcHBlcihrZXksIDE5LCBzbGljZShhcmd1bWVudHMsIDIpLCBudWxsLCBvYmplY3QpXG4gICAgICAgIDogY3JlYXRlV3JhcHBlcihrZXksIDMsIG51bGwsIG51bGwsIG9iamVjdCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaXMgdGhlIGNvbXBvc2l0aW9uIG9mIHRoZSBwcm92aWRlZCBmdW5jdGlvbnMsXG4gICAgICogd2hlcmUgZWFjaCBmdW5jdGlvbiBjb25zdW1lcyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB0aGF0IGZvbGxvd3MuXG4gICAgICogRm9yIGV4YW1wbGUsIGNvbXBvc2luZyB0aGUgZnVuY3Rpb25zIGBmKClgLCBgZygpYCwgYW5kIGBoKClgIHByb2R1Y2VzIGBmKGcoaCgpKSlgLlxuICAgICAqIEVhY2ggZnVuY3Rpb24gaXMgZXhlY3V0ZWQgd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNvbXBvc2VkIGZ1bmN0aW9uLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgICAqIEBwYXJhbSB7Li4uRnVuY3Rpb259IFtmdW5jXSBGdW5jdGlvbnMgdG8gY29tcG9zZS5cbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBjb21wb3NlZCBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIHJlYWxOYW1lTWFwID0ge1xuICAgICAqICAgJ3BlYmJsZXMnOiAncGVuZWxvcGUnXG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIHZhciBmb3JtYXQgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICogICBuYW1lID0gcmVhbE5hbWVNYXBbbmFtZS50b0xvd2VyQ2FzZSgpXSB8fCBuYW1lO1xuICAgICAqICAgcmV0dXJuIG5hbWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBuYW1lLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCk7XG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIHZhciBncmVldCA9IGZ1bmN0aW9uKGZvcm1hdHRlZCkge1xuICAgICAqICAgcmV0dXJuICdIaXlhICcgKyBmb3JtYXR0ZWQgKyAnISc7XG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIHZhciB3ZWxjb21lID0gXy5jb21wb3NlKGdyZWV0LCBmb3JtYXQpO1xuICAgICAqIHdlbGNvbWUoJ3BlYmJsZXMnKTtcbiAgICAgKiAvLyA9PiAnSGl5YSBQZW5lbG9wZSEnXG4gICAgICovXG4gICAgZnVuY3Rpb24gY29tcG9zZSgpIHtcbiAgICAgIHZhciBmdW5jcyA9IGFyZ3VtZW50cyxcbiAgICAgICAgICBsZW5ndGggPSBmdW5jcy5sZW5ndGg7XG5cbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICBpZiAoIWlzRnVuY3Rpb24oZnVuY3NbbGVuZ3RoXSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICAgICAgbGVuZ3RoID0gZnVuY3MubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICAgIGFyZ3MgPSBbZnVuY3NbbGVuZ3RoXS5hcHBseSh0aGlzLCBhcmdzKV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFyZ3NbMF07XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB3aGljaCBhY2NlcHRzIG9uZSBvciBtb3JlIGFyZ3VtZW50cyBvZiBgZnVuY2AgdGhhdCB3aGVuXG4gICAgICogaW52b2tlZCBlaXRoZXIgZXhlY3V0ZXMgYGZ1bmNgIHJldHVybmluZyBpdHMgcmVzdWx0LCBpZiBhbGwgYGZ1bmNgIGFyZ3VtZW50c1xuICAgICAqIGhhdmUgYmVlbiBwcm92aWRlZCwgb3IgcmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgYWNjZXB0cyBvbmUgb3IgbW9yZSBvZiB0aGVcbiAgICAgKiByZW1haW5pbmcgYGZ1bmNgIGFyZ3VtZW50cywgYW5kIHNvIG9uLiBUaGUgYXJpdHkgb2YgYGZ1bmNgIGNhbiBiZSBzcGVjaWZpZWRcbiAgICAgKiBpZiBgZnVuYy5sZW5ndGhgIGlzIG5vdCBzdWZmaWNpZW50LlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGN1cnJ5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYXJpdHk9ZnVuYy5sZW5ndGhdIFRoZSBhcml0eSBvZiBgZnVuY2AuXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgY3VycmllZCBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGN1cnJpZWQgPSBfLmN1cnJ5KGZ1bmN0aW9uKGEsIGIsIGMpIHtcbiAgICAgKiAgIGNvbnNvbGUubG9nKGEgKyBiICsgYyk7XG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBjdXJyaWVkKDEpKDIpKDMpO1xuICAgICAqIC8vID0+IDZcbiAgICAgKlxuICAgICAqIGN1cnJpZWQoMSwgMikoMyk7XG4gICAgICogLy8gPT4gNlxuICAgICAqXG4gICAgICogY3VycmllZCgxLCAyLCAzKTtcbiAgICAgKiAvLyA9PiA2XG4gICAgICovXG4gICAgZnVuY3Rpb24gY3VycnkoZnVuYywgYXJpdHkpIHtcbiAgICAgIGFyaXR5ID0gdHlwZW9mIGFyaXR5ID09ICdudW1iZXInID8gYXJpdHkgOiAoK2FyaXR5IHx8IGZ1bmMubGVuZ3RoKTtcbiAgICAgIHJldHVybiBjcmVhdGVXcmFwcGVyKGZ1bmMsIDQsIG51bGwsIG51bGwsIG51bGwsIGFyaXR5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGRlbGF5IHRoZSBleGVjdXRpb24gb2YgYGZ1bmNgIHVudGlsIGFmdGVyXG4gICAgICogYHdhaXRgIG1pbGxpc2Vjb25kcyBoYXZlIGVsYXBzZWQgc2luY2UgdGhlIGxhc3QgdGltZSBpdCB3YXMgaW52b2tlZC5cbiAgICAgKiBQcm92aWRlIGFuIG9wdGlvbnMgb2JqZWN0IHRvIGluZGljYXRlIHRoYXQgYGZ1bmNgIHNob3VsZCBiZSBpbnZva2VkIG9uXG4gICAgICogdGhlIGxlYWRpbmcgYW5kL29yIHRyYWlsaW5nIGVkZ2Ugb2YgdGhlIGB3YWl0YCB0aW1lb3V0LiBTdWJzZXF1ZW50IGNhbGxzXG4gICAgICogdG8gdGhlIGRlYm91bmNlZCBmdW5jdGlvbiB3aWxsIHJldHVybiB0aGUgcmVzdWx0IG9mIHRoZSBsYXN0IGBmdW5jYCBjYWxsLlxuICAgICAqXG4gICAgICogTm90ZTogSWYgYGxlYWRpbmdgIGFuZCBgdHJhaWxpbmdgIG9wdGlvbnMgYXJlIGB0cnVlYCBgZnVuY2Agd2lsbCBiZSBjYWxsZWRcbiAgICAgKiBvbiB0aGUgdHJhaWxpbmcgZWRnZSBvZiB0aGUgdGltZW91dCBvbmx5IGlmIHRoZSB0aGUgZGVib3VuY2VkIGZ1bmN0aW9uIGlzXG4gICAgICogaW52b2tlZCBtb3JlIHRoYW4gb25jZSBkdXJpbmcgdGhlIGB3YWl0YCB0aW1lb3V0LlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGRlYm91bmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3YWl0IFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIGRlbGF5LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubGVhZGluZz1mYWxzZV0gU3BlY2lmeSBleGVjdXRpb24gb24gdGhlIGxlYWRpbmcgZWRnZSBvZiB0aGUgdGltZW91dC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4V2FpdF0gVGhlIG1heGltdW0gdGltZSBgZnVuY2AgaXMgYWxsb3dlZCB0byBiZSBkZWxheWVkIGJlZm9yZSBpdCdzIGNhbGxlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnRyYWlsaW5nPXRydWVdIFNwZWNpZnkgZXhlY3V0aW9uIG9uIHRoZSB0cmFpbGluZyBlZGdlIG9mIHRoZSB0aW1lb3V0LlxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGRlYm91bmNlZCBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogLy8gYXZvaWQgY29zdGx5IGNhbGN1bGF0aW9ucyB3aGlsZSB0aGUgd2luZG93IHNpemUgaXMgaW4gZmx1eFxuICAgICAqIHZhciBsYXp5TGF5b3V0ID0gXy5kZWJvdW5jZShjYWxjdWxhdGVMYXlvdXQsIDE1MCk7XG4gICAgICogalF1ZXJ5KHdpbmRvdykub24oJ3Jlc2l6ZScsIGxhenlMYXlvdXQpO1xuICAgICAqXG4gICAgICogLy8gZXhlY3V0ZSBgc2VuZE1haWxgIHdoZW4gdGhlIGNsaWNrIGV2ZW50IGlzIGZpcmVkLCBkZWJvdW5jaW5nIHN1YnNlcXVlbnQgY2FsbHNcbiAgICAgKiBqUXVlcnkoJyNwb3N0Ym94Jykub24oJ2NsaWNrJywgXy5kZWJvdW5jZShzZW5kTWFpbCwgMzAwLCB7XG4gICAgICogICAnbGVhZGluZyc6IHRydWUsXG4gICAgICogICAndHJhaWxpbmcnOiBmYWxzZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gZW5zdXJlIGBiYXRjaExvZ2AgaXMgZXhlY3V0ZWQgb25jZSBhZnRlciAxIHNlY29uZCBvZiBkZWJvdW5jZWQgY2FsbHNcbiAgICAgKiB2YXIgc291cmNlID0gbmV3IEV2ZW50U291cmNlKCcvc3RyZWFtJyk7XG4gICAgICogc291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBfLmRlYm91bmNlKGJhdGNoTG9nLCAyNTAsIHtcbiAgICAgKiAgICdtYXhXYWl0JzogMTAwMFxuICAgICAqIH0sIGZhbHNlKTtcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBkZWJvdW5jZShmdW5jLCB3YWl0LCBvcHRpb25zKSB7XG4gICAgICB2YXIgYXJncyxcbiAgICAgICAgICBtYXhUaW1lb3V0SWQsXG4gICAgICAgICAgcmVzdWx0LFxuICAgICAgICAgIHN0YW1wLFxuICAgICAgICAgIHRoaXNBcmcsXG4gICAgICAgICAgdGltZW91dElkLFxuICAgICAgICAgIHRyYWlsaW5nQ2FsbCxcbiAgICAgICAgICBsYXN0Q2FsbGVkID0gMCxcbiAgICAgICAgICBtYXhXYWl0ID0gZmFsc2UsXG4gICAgICAgICAgdHJhaWxpbmcgPSB0cnVlO1xuXG4gICAgICBpZiAoIWlzRnVuY3Rpb24oZnVuYykpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcjtcbiAgICAgIH1cbiAgICAgIHdhaXQgPSBuYXRpdmVNYXgoMCwgd2FpdCkgfHwgMDtcbiAgICAgIGlmIChvcHRpb25zID09PSB0cnVlKSB7XG4gICAgICAgIHZhciBsZWFkaW5nID0gdHJ1ZTtcbiAgICAgICAgdHJhaWxpbmcgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoaXNPYmplY3Qob3B0aW9ucykpIHtcbiAgICAgICAgbGVhZGluZyA9IG9wdGlvbnMubGVhZGluZztcbiAgICAgICAgbWF4V2FpdCA9ICdtYXhXYWl0JyBpbiBvcHRpb25zICYmIChuYXRpdmVNYXgod2FpdCwgb3B0aW9ucy5tYXhXYWl0KSB8fCAwKTtcbiAgICAgICAgdHJhaWxpbmcgPSAndHJhaWxpbmcnIGluIG9wdGlvbnMgPyBvcHRpb25zLnRyYWlsaW5nIDogdHJhaWxpbmc7XG4gICAgICB9XG4gICAgICB2YXIgZGVsYXllZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChub3coKSAtIHN0YW1wKTtcbiAgICAgICAgaWYgKHJlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgICAgaWYgKG1heFRpbWVvdXRJZCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KG1heFRpbWVvdXRJZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBpc0NhbGxlZCA9IHRyYWlsaW5nQ2FsbDtcbiAgICAgICAgICBtYXhUaW1lb3V0SWQgPSB0aW1lb3V0SWQgPSB0cmFpbGluZ0NhbGwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgaWYgKGlzQ2FsbGVkKSB7XG4gICAgICAgICAgICBsYXN0Q2FsbGVkID0gbm93KCk7XG4gICAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xuICAgICAgICAgICAgaWYgKCF0aW1lb3V0SWQgJiYgIW1heFRpbWVvdXRJZCkge1xuICAgICAgICAgICAgICBhcmdzID0gdGhpc0FyZyA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZGVsYXllZCwgcmVtYWluaW5nKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgdmFyIG1heERlbGF5ZWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRpbWVvdXRJZCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICB9XG4gICAgICAgIG1heFRpbWVvdXRJZCA9IHRpbWVvdXRJZCA9IHRyYWlsaW5nQ2FsbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKHRyYWlsaW5nIHx8IChtYXhXYWl0ICE9PSB3YWl0KSkge1xuICAgICAgICAgIGxhc3RDYWxsZWQgPSBub3coKTtcbiAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xuICAgICAgICAgIGlmICghdGltZW91dElkICYmICFtYXhUaW1lb3V0SWQpIHtcbiAgICAgICAgICAgIGFyZ3MgPSB0aGlzQXJnID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgc3RhbXAgPSBub3coKTtcbiAgICAgICAgdGhpc0FyZyA9IHRoaXM7XG4gICAgICAgIHRyYWlsaW5nQ2FsbCA9IHRyYWlsaW5nICYmICh0aW1lb3V0SWQgfHwgIWxlYWRpbmcpO1xuXG4gICAgICAgIGlmIChtYXhXYWl0ID09PSBmYWxzZSkge1xuICAgICAgICAgIHZhciBsZWFkaW5nQ2FsbCA9IGxlYWRpbmcgJiYgIXRpbWVvdXRJZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoIW1heFRpbWVvdXRJZCAmJiAhbGVhZGluZykge1xuICAgICAgICAgICAgbGFzdENhbGxlZCA9IHN0YW1wO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgcmVtYWluaW5nID0gbWF4V2FpdCAtIChzdGFtcCAtIGxhc3RDYWxsZWQpLFxuICAgICAgICAgICAgICBpc0NhbGxlZCA9IHJlbWFpbmluZyA8PSAwO1xuXG4gICAgICAgICAgaWYgKGlzQ2FsbGVkKSB7XG4gICAgICAgICAgICBpZiAobWF4VGltZW91dElkKSB7XG4gICAgICAgICAgICAgIG1heFRpbWVvdXRJZCA9IGNsZWFyVGltZW91dChtYXhUaW1lb3V0SWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdENhbGxlZCA9IHN0YW1wO1xuICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAoIW1heFRpbWVvdXRJZCkge1xuICAgICAgICAgICAgbWF4VGltZW91dElkID0gc2V0VGltZW91dChtYXhEZWxheWVkLCByZW1haW5pbmcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNDYWxsZWQgJiYgdGltZW91dElkKSB7XG4gICAgICAgICAgdGltZW91dElkID0gY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoIXRpbWVvdXRJZCAmJiB3YWl0ICE9PSBtYXhXYWl0KSB7XG4gICAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChkZWxheWVkLCB3YWl0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGVhZGluZ0NhbGwpIHtcbiAgICAgICAgICBpc0NhbGxlZCA9IHRydWU7XG4gICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNDYWxsZWQgJiYgIXRpbWVvdXRJZCAmJiAhbWF4VGltZW91dElkKSB7XG4gICAgICAgICAgYXJncyA9IHRoaXNBcmcgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmVycyBleGVjdXRpbmcgdGhlIGBmdW5jYCBmdW5jdGlvbiB1bnRpbCB0aGUgY3VycmVudCBjYWxsIHN0YWNrIGhhcyBjbGVhcmVkLlxuICAgICAqIEFkZGl0aW9uYWwgYXJndW1lbnRzIHdpbGwgYmUgcHJvdmlkZWQgdG8gYGZ1bmNgIHdoZW4gaXQgaXMgaW52b2tlZC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBkZWZlci5cbiAgICAgKiBAcGFyYW0gey4uLip9IFthcmddIEFyZ3VtZW50cyB0byBpbnZva2UgdGhlIGZ1bmN0aW9uIHdpdGguXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgdGltZXIgaWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8uZGVmZXIoZnVuY3Rpb24odGV4dCkgeyBjb25zb2xlLmxvZyh0ZXh0KTsgfSwgJ2RlZmVycmVkJyk7XG4gICAgICogLy8gbG9ncyAnZGVmZXJyZWQnIGFmdGVyIG9uZSBvciBtb3JlIG1pbGxpc2Vjb25kc1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIGRlZmVyKGZ1bmMpIHtcbiAgICAgIGlmICghaXNGdW5jdGlvbihmdW5jKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yO1xuICAgICAgfVxuICAgICAgdmFyIGFyZ3MgPSBzbGljZShhcmd1bWVudHMsIDEpO1xuICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGZ1bmMuYXBwbHkodW5kZWZpbmVkLCBhcmdzKTsgfSwgMSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZXMgdGhlIGBmdW5jYCBmdW5jdGlvbiBhZnRlciBgd2FpdGAgbWlsbGlzZWNvbmRzLiBBZGRpdGlvbmFsIGFyZ3VtZW50c1xuICAgICAqIHdpbGwgYmUgcHJvdmlkZWQgdG8gYGZ1bmNgIHdoZW4gaXQgaXMgaW52b2tlZC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBkZWxheS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2FpdCBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0byBkZWxheSBleGVjdXRpb24uXG4gICAgICogQHBhcmFtIHsuLi4qfSBbYXJnXSBBcmd1bWVudHMgdG8gaW52b2tlIHRoZSBmdW5jdGlvbiB3aXRoLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIHRpbWVyIGlkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmRlbGF5KGZ1bmN0aW9uKHRleHQpIHsgY29uc29sZS5sb2codGV4dCk7IH0sIDEwMDAsICdsYXRlcicpO1xuICAgICAqIC8vID0+IGxvZ3MgJ2xhdGVyJyBhZnRlciBvbmUgc2Vjb25kXG4gICAgICovXG4gICAgZnVuY3Rpb24gZGVsYXkoZnVuYywgd2FpdCkge1xuICAgICAgaWYgKCFpc0Z1bmN0aW9uKGZ1bmMpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgICB9XG4gICAgICB2YXIgYXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMik7XG4gICAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHsgZnVuYy5hcHBseSh1bmRlZmluZWQsIGFyZ3MpOyB9LCB3YWl0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBtZW1vaXplcyB0aGUgcmVzdWx0IG9mIGBmdW5jYC4gSWYgYHJlc29sdmVyYCBpc1xuICAgICAqIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZCB0byBkZXRlcm1pbmUgdGhlIGNhY2hlIGtleSBmb3Igc3RvcmluZyB0aGUgcmVzdWx0XG4gICAgICogYmFzZWQgb24gdGhlIGFyZ3VtZW50cyBwcm92aWRlZCB0byB0aGUgbWVtb2l6ZWQgZnVuY3Rpb24uIEJ5IGRlZmF1bHQsIHRoZVxuICAgICAqIGZpcnN0IGFyZ3VtZW50IHByb3ZpZGVkIHRvIHRoZSBtZW1vaXplZCBmdW5jdGlvbiBpcyB1c2VkIGFzIHRoZSBjYWNoZSBrZXkuXG4gICAgICogVGhlIGBmdW5jYCBpcyBleGVjdXRlZCB3aXRoIHRoZSBgdGhpc2AgYmluZGluZyBvZiB0aGUgbWVtb2l6ZWQgZnVuY3Rpb24uXG4gICAgICogVGhlIHJlc3VsdCBjYWNoZSBpcyBleHBvc2VkIGFzIHRoZSBgY2FjaGVgIHByb3BlcnR5IG9uIHRoZSBtZW1vaXplZCBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBoYXZlIGl0cyBvdXRwdXQgbWVtb2l6ZWQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW3Jlc29sdmVyXSBBIGZ1bmN0aW9uIHVzZWQgdG8gcmVzb2x2ZSB0aGUgY2FjaGUga2V5LlxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IG1lbW9pemluZyBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGZpYm9uYWNjaSA9IF8ubWVtb2l6ZShmdW5jdGlvbihuKSB7XG4gICAgICogICByZXR1cm4gbiA8IDIgPyBuIDogZmlib25hY2NpKG4gLSAxKSArIGZpYm9uYWNjaShuIC0gMik7XG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBmaWJvbmFjY2koOSlcbiAgICAgKiAvLyA9PiAzNFxuICAgICAqXG4gICAgICogdmFyIGRhdGEgPSB7XG4gICAgICogICAnZnJlZCc6IHsgJ25hbWUnOiAnZnJlZCcsICdhZ2UnOiA0MCB9LFxuICAgICAqICAgJ3BlYmJsZXMnOiB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYWdlJzogMSB9XG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIC8vIG1vZGlmeWluZyB0aGUgcmVzdWx0IGNhY2hlXG4gICAgICogdmFyIGdldCA9IF8ubWVtb2l6ZShmdW5jdGlvbihuYW1lKSB7IHJldHVybiBkYXRhW25hbWVdOyB9LCBfLmlkZW50aXR5KTtcbiAgICAgKiBnZXQoJ3BlYmJsZXMnKTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYWdlJzogMSB9XG4gICAgICpcbiAgICAgKiBnZXQuY2FjaGUucGViYmxlcy5uYW1lID0gJ3BlbmVsb3BlJztcbiAgICAgKiBnZXQoJ3BlYmJsZXMnKTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ3BlbmVsb3BlJywgJ2FnZSc6IDEgfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG1lbW9pemUoZnVuYywgcmVzb2x2ZXIpIHtcbiAgICAgIGlmICghaXNGdW5jdGlvbihmdW5jKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yO1xuICAgICAgfVxuICAgICAgdmFyIG1lbW9pemVkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjYWNoZSA9IG1lbW9pemVkLmNhY2hlLFxuICAgICAgICAgICAga2V5ID0gcmVzb2x2ZXIgPyByZXNvbHZlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIDoga2V5UHJlZml4ICsgYXJndW1lbnRzWzBdO1xuXG4gICAgICAgIHJldHVybiBoYXNPd25Qcm9wZXJ0eS5jYWxsKGNhY2hlLCBrZXkpXG4gICAgICAgICAgPyBjYWNoZVtrZXldXG4gICAgICAgICAgOiAoY2FjaGVba2V5XSA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKSk7XG4gICAgICB9XG4gICAgICBtZW1vaXplZC5jYWNoZSA9IHt9O1xuICAgICAgcmV0dXJuIG1lbW9pemVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGlzIHJlc3RyaWN0ZWQgdG8gZXhlY3V0ZSBgZnVuY2Agb25jZS4gUmVwZWF0IGNhbGxzIHRvXG4gICAgICogdGhlIGZ1bmN0aW9uIHdpbGwgcmV0dXJuIHRoZSB2YWx1ZSBvZiB0aGUgZmlyc3QgY2FsbC4gVGhlIGBmdW5jYCBpcyBleGVjdXRlZFxuICAgICAqIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBjcmVhdGVkIGZ1bmN0aW9uLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHJlc3RyaWN0LlxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHJlc3RyaWN0ZWQgZnVuY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBpbml0aWFsaXplID0gXy5vbmNlKGNyZWF0ZUFwcGxpY2F0aW9uKTtcbiAgICAgKiBpbml0aWFsaXplKCk7XG4gICAgICogaW5pdGlhbGl6ZSgpO1xuICAgICAqIC8vIGBpbml0aWFsaXplYCBleGVjdXRlcyBgY3JlYXRlQXBwbGljYXRpb25gIG9uY2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBvbmNlKGZ1bmMpIHtcbiAgICAgIHZhciByYW4sXG4gICAgICAgICAgcmVzdWx0O1xuXG4gICAgICBpZiAoIWlzRnVuY3Rpb24oZnVuYykpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHJhbikge1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgcmFuID0gdHJ1ZTtcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgICAgIC8vIGNsZWFyIHRoZSBgZnVuY2AgdmFyaWFibGUgc28gdGhlIGZ1bmN0aW9uIG1heSBiZSBnYXJiYWdlIGNvbGxlY3RlZFxuICAgICAgICBmdW5jID0gbnVsbDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCBpbnZva2VzIGBmdW5jYCB3aXRoIGFueSBhZGRpdGlvbmFsXG4gICAgICogYHBhcnRpYWxgIGFyZ3VtZW50cyBwcmVwZW5kZWQgdG8gdGhvc2UgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi4gVGhpc1xuICAgICAqIG1ldGhvZCBpcyBzaW1pbGFyIHRvIGBfLmJpbmRgIGV4Y2VwdCBpdCBkb2VzICoqbm90KiogYWx0ZXIgdGhlIGB0aGlzYCBiaW5kaW5nLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHBhcnRpYWxseSBhcHBseSBhcmd1bWVudHMgdG8uXG4gICAgICogQHBhcmFtIHsuLi4qfSBbYXJnXSBBcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcGFydGlhbGx5IGFwcGxpZWQgZnVuY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBncmVldCA9IGZ1bmN0aW9uKGdyZWV0aW5nLCBuYW1lKSB7IHJldHVybiBncmVldGluZyArICcgJyArIG5hbWU7IH07XG4gICAgICogdmFyIGhpID0gXy5wYXJ0aWFsKGdyZWV0LCAnaGknKTtcbiAgICAgKiBoaSgnZnJlZCcpO1xuICAgICAqIC8vID0+ICdoaSBmcmVkJ1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIHBhcnRpYWwoZnVuYykge1xuICAgICAgcmV0dXJuIGNyZWF0ZVdyYXBwZXIoZnVuYywgMTYsIHNsaWNlKGFyZ3VtZW50cywgMSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoaXMgbWV0aG9kIGlzIGxpa2UgYF8ucGFydGlhbGAgZXhjZXB0IHRoYXQgYHBhcnRpYWxgIGFyZ3VtZW50cyBhcmVcbiAgICAgKiBhcHBlbmRlZCB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgbmV3IGZ1bmN0aW9uLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHBhcnRpYWxseSBhcHBseSBhcmd1bWVudHMgdG8uXG4gICAgICogQHBhcmFtIHsuLi4qfSBbYXJnXSBBcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcGFydGlhbGx5IGFwcGxpZWQgZnVuY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBkZWZhdWx0c0RlZXAgPSBfLnBhcnRpYWxSaWdodChfLm1lcmdlLCBfLmRlZmF1bHRzKTtcbiAgICAgKlxuICAgICAqIHZhciBvcHRpb25zID0ge1xuICAgICAqICAgJ3ZhcmlhYmxlJzogJ2RhdGEnLFxuICAgICAqICAgJ2ltcG9ydHMnOiB7ICdqcSc6ICQgfVxuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBkZWZhdWx0c0RlZXAob3B0aW9ucywgXy50ZW1wbGF0ZVNldHRpbmdzKTtcbiAgICAgKlxuICAgICAqIG9wdGlvbnMudmFyaWFibGVcbiAgICAgKiAvLyA9PiAnZGF0YSdcbiAgICAgKlxuICAgICAqIG9wdGlvbnMuaW1wb3J0c1xuICAgICAqIC8vID0+IHsgJ18nOiBfLCAnanEnOiAkIH1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBwYXJ0aWFsUmlnaHQoZnVuYykge1xuICAgICAgcmV0dXJuIGNyZWF0ZVdyYXBwZXIoZnVuYywgMzIsIG51bGwsIHNsaWNlKGFyZ3VtZW50cywgMSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGV4ZWN1dGVkLCB3aWxsIG9ubHkgY2FsbCB0aGUgYGZ1bmNgIGZ1bmN0aW9uXG4gICAgICogYXQgbW9zdCBvbmNlIHBlciBldmVyeSBgd2FpdGAgbWlsbGlzZWNvbmRzLiBQcm92aWRlIGFuIG9wdGlvbnMgb2JqZWN0IHRvXG4gICAgICogaW5kaWNhdGUgdGhhdCBgZnVuY2Agc2hvdWxkIGJlIGludm9rZWQgb24gdGhlIGxlYWRpbmcgYW5kL29yIHRyYWlsaW5nIGVkZ2VcbiAgICAgKiBvZiB0aGUgYHdhaXRgIHRpbWVvdXQuIFN1YnNlcXVlbnQgY2FsbHMgdG8gdGhlIHRocm90dGxlZCBmdW5jdGlvbiB3aWxsXG4gICAgICogcmV0dXJuIHRoZSByZXN1bHQgb2YgdGhlIGxhc3QgYGZ1bmNgIGNhbGwuXG4gICAgICpcbiAgICAgKiBOb3RlOiBJZiBgbGVhZGluZ2AgYW5kIGB0cmFpbGluZ2Agb3B0aW9ucyBhcmUgYHRydWVgIGBmdW5jYCB3aWxsIGJlIGNhbGxlZFxuICAgICAqIG9uIHRoZSB0cmFpbGluZyBlZGdlIG9mIHRoZSB0aW1lb3V0IG9ubHkgaWYgdGhlIHRoZSB0aHJvdHRsZWQgZnVuY3Rpb24gaXNcbiAgICAgKiBpbnZva2VkIG1vcmUgdGhhbiBvbmNlIGR1cmluZyB0aGUgYHdhaXRgIHRpbWVvdXQuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gdGhyb3R0bGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdhaXQgVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gdGhyb3R0bGUgZXhlY3V0aW9ucyB0by5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmxlYWRpbmc9dHJ1ZV0gU3BlY2lmeSBleGVjdXRpb24gb24gdGhlIGxlYWRpbmcgZWRnZSBvZiB0aGUgdGltZW91dC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnRyYWlsaW5nPXRydWVdIFNwZWNpZnkgZXhlY3V0aW9uIG9uIHRoZSB0cmFpbGluZyBlZGdlIG9mIHRoZSB0aW1lb3V0LlxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHRocm90dGxlZCBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogLy8gYXZvaWQgZXhjZXNzaXZlbHkgdXBkYXRpbmcgdGhlIHBvc2l0aW9uIHdoaWxlIHNjcm9sbGluZ1xuICAgICAqIHZhciB0aHJvdHRsZWQgPSBfLnRocm90dGxlKHVwZGF0ZVBvc2l0aW9uLCAxMDApO1xuICAgICAqIGpRdWVyeSh3aW5kb3cpLm9uKCdzY3JvbGwnLCB0aHJvdHRsZWQpO1xuICAgICAqXG4gICAgICogLy8gZXhlY3V0ZSBgcmVuZXdUb2tlbmAgd2hlbiB0aGUgY2xpY2sgZXZlbnQgaXMgZmlyZWQsIGJ1dCBub3QgbW9yZSB0aGFuIG9uY2UgZXZlcnkgNSBtaW51dGVzXG4gICAgICogalF1ZXJ5KCcuaW50ZXJhY3RpdmUnKS5vbignY2xpY2snLCBfLnRocm90dGxlKHJlbmV3VG9rZW4sIDMwMDAwMCwge1xuICAgICAqICAgJ3RyYWlsaW5nJzogZmFsc2VcbiAgICAgKiB9KSk7XG4gICAgICovXG4gICAgZnVuY3Rpb24gdGhyb3R0bGUoZnVuYywgd2FpdCwgb3B0aW9ucykge1xuICAgICAgdmFyIGxlYWRpbmcgPSB0cnVlLFxuICAgICAgICAgIHRyYWlsaW5nID0gdHJ1ZTtcblxuICAgICAgaWYgKCFpc0Z1bmN0aW9uKGZ1bmMpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucyA9PT0gZmFsc2UpIHtcbiAgICAgICAgbGVhZGluZyA9IGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChpc09iamVjdChvcHRpb25zKSkge1xuICAgICAgICBsZWFkaW5nID0gJ2xlYWRpbmcnIGluIG9wdGlvbnMgPyBvcHRpb25zLmxlYWRpbmcgOiBsZWFkaW5nO1xuICAgICAgICB0cmFpbGluZyA9ICd0cmFpbGluZycgaW4gb3B0aW9ucyA/IG9wdGlvbnMudHJhaWxpbmcgOiB0cmFpbGluZztcbiAgICAgIH1cbiAgICAgIGRlYm91bmNlT3B0aW9ucy5sZWFkaW5nID0gbGVhZGluZztcbiAgICAgIGRlYm91bmNlT3B0aW9ucy5tYXhXYWl0ID0gd2FpdDtcbiAgICAgIGRlYm91bmNlT3B0aW9ucy50cmFpbGluZyA9IHRyYWlsaW5nO1xuXG4gICAgICByZXR1cm4gZGVib3VuY2UoZnVuYywgd2FpdCwgZGVib3VuY2VPcHRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBwcm92aWRlcyBgdmFsdWVgIHRvIHRoZSB3cmFwcGVyIGZ1bmN0aW9uIGFzIGl0c1xuICAgICAqIGZpcnN0IGFyZ3VtZW50LiBBZGRpdGlvbmFsIGFyZ3VtZW50cyBwcm92aWRlZCB0byB0aGUgZnVuY3Rpb24gYXJlIGFwcGVuZGVkXG4gICAgICogdG8gdGhvc2UgcHJvdmlkZWQgdG8gdGhlIHdyYXBwZXIgZnVuY3Rpb24uIFRoZSB3cmFwcGVyIGlzIGV4ZWN1dGVkIHdpdGhcbiAgICAgKiB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNyZWF0ZWQgZnVuY3Rpb24uXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gd3JhcC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB3cmFwcGVyIFRoZSB3cmFwcGVyIGZ1bmN0aW9uLlxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgcCA9IF8ud3JhcChfLmVzY2FwZSwgZnVuY3Rpb24oZnVuYywgdGV4dCkge1xuICAgICAqICAgcmV0dXJuICc8cD4nICsgZnVuYyh0ZXh0KSArICc8L3A+JztcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIHAoJ0ZyZWQsIFdpbG1hLCAmIFBlYmJsZXMnKTtcbiAgICAgKiAvLyA9PiAnPHA+RnJlZCwgV2lsbWEsICZhbXA7IFBlYmJsZXM8L3A+J1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIHdyYXAodmFsdWUsIHdyYXBwZXIpIHtcbiAgICAgIHJldHVybiBjcmVhdGVXcmFwcGVyKHdyYXBwZXIsIDE2LCBbdmFsdWVdKTtcbiAgICB9XG5cbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byByZXR1cm4gZnJvbSB0aGUgbmV3IGZ1bmN0aW9uLlxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgb2JqZWN0ID0geyAnbmFtZSc6ICdmcmVkJyB9O1xuICAgICAqIHZhciBnZXR0ZXIgPSBfLmNvbnN0YW50KG9iamVjdCk7XG4gICAgICogZ2V0dGVyKCkgPT09IG9iamVjdDtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICovXG4gICAgZnVuY3Rpb24gY29uc3RhbnQodmFsdWUpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm9kdWNlcyBhIGNhbGxiYWNrIGJvdW5kIHRvIGFuIG9wdGlvbmFsIGB0aGlzQXJnYC4gSWYgYGZ1bmNgIGlzIGEgcHJvcGVydHlcbiAgICAgKiBuYW1lIHRoZSBjcmVhdGVkIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBmb3IgYSBnaXZlbiBlbGVtZW50LlxuICAgICAqIElmIGBmdW5jYCBpcyBhbiBvYmplY3QgdGhlIGNyZWF0ZWQgY2FsbGJhY2sgd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50c1xuICAgICAqIHRoYXQgY29udGFpbiB0aGUgZXF1aXZhbGVudCBvYmplY3QgcHJvcGVydGllcywgb3RoZXJ3aXNlIGl0IHdpbGwgcmV0dXJuIGBmYWxzZWAuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAgICogQHBhcmFtIHsqfSBbZnVuYz1pZGVudGl0eV0gVGhlIHZhbHVlIHRvIGNvbnZlcnQgdG8gYSBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNyZWF0ZWQgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFthcmdDb3VudF0gVGhlIG51bWJlciBvZiBhcmd1bWVudHMgdGhlIGNhbGxiYWNrIGFjY2VwdHMuXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIGEgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cbiAgICAgKiBdO1xuICAgICAqXG4gICAgICogLy8gd3JhcCB0byBjcmVhdGUgY3VzdG9tIGNhbGxiYWNrIHNob3J0aGFuZHNcbiAgICAgKiBfLmNyZWF0ZUNhbGxiYWNrID0gXy53cmFwKF8uY3JlYXRlQ2FsbGJhY2ssIGZ1bmN0aW9uKGZ1bmMsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICogICB2YXIgbWF0Y2ggPSAvXiguKz8pX18oW2dsXXQpKC4rKSQvLmV4ZWMoY2FsbGJhY2spO1xuICAgICAqICAgcmV0dXJuICFtYXRjaCA/IGZ1bmMoY2FsbGJhY2ssIHRoaXNBcmcpIDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICogICAgIHJldHVybiBtYXRjaFsyXSA9PSAnZ3QnID8gb2JqZWN0W21hdGNoWzFdXSA+IG1hdGNoWzNdIDogb2JqZWN0W21hdGNoWzFdXSA8IG1hdGNoWzNdO1xuICAgICAqICAgfTtcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIF8uZmlsdGVyKGNoYXJhY3RlcnMsICdhZ2VfX2d0MzgnKTtcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdmcmVkJywgJ2FnZSc6IDQwIH1dXG4gICAgICovXG4gICAgZnVuY3Rpb24gY3JlYXRlQ2FsbGJhY2soZnVuYywgdGhpc0FyZywgYXJnQ291bnQpIHtcbiAgICAgIHZhciB0eXBlID0gdHlwZW9mIGZ1bmM7XG4gICAgICBpZiAoZnVuYyA9PSBudWxsIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gYmFzZUNyZWF0ZUNhbGxiYWNrKGZ1bmMsIHRoaXNBcmcsIGFyZ0NvdW50KTtcbiAgICAgIH1cbiAgICAgIC8vIGhhbmRsZSBcIl8ucGx1Y2tcIiBzdHlsZSBjYWxsYmFjayBzaG9ydGhhbmRzXG4gICAgICBpZiAodHlwZSAhPSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gcHJvcGVydHkoZnVuYyk7XG4gICAgICB9XG4gICAgICB2YXIgcHJvcHMgPSBrZXlzKGZ1bmMpLFxuICAgICAgICAgIGtleSA9IHByb3BzWzBdLFxuICAgICAgICAgIGEgPSBmdW5jW2tleV07XG5cbiAgICAgIC8vIGhhbmRsZSBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjayBzaG9ydGhhbmRzXG4gICAgICBpZiAocHJvcHMubGVuZ3RoID09IDEgJiYgYSA9PT0gYSAmJiAhaXNPYmplY3QoYSkpIHtcbiAgICAgICAgLy8gZmFzdCBwYXRoIHRoZSBjb21tb24gY2FzZSBvZiBwcm92aWRpbmcgYW4gb2JqZWN0IHdpdGggYSBzaW5nbGVcbiAgICAgICAgLy8gcHJvcGVydHkgY29udGFpbmluZyBhIHByaW1pdGl2ZSB2YWx1ZVxuICAgICAgICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICAgICAgdmFyIGIgPSBvYmplY3Rba2V5XTtcbiAgICAgICAgICByZXR1cm4gYSA9PT0gYiAmJiAoYSAhPT0gMCB8fCAoMSAvIGEgPT0gMSAvIGIpKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgICAgdmFyIGxlbmd0aCA9IHByb3BzLmxlbmd0aCxcbiAgICAgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuXG4gICAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9IGJhc2VJc0VxdWFsKG9iamVjdFtwcm9wc1tsZW5ndGhdXSwgZnVuY1twcm9wc1tsZW5ndGhdXSwgbnVsbCwgdHJ1ZSkpKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIGNoYXJhY3RlcnMgYCZgLCBgPGAsIGA+YCwgYFwiYCwgYW5kIGAnYCBpbiBgc3RyaW5nYCB0byB0aGVpclxuICAgICAqIGNvcnJlc3BvbmRpbmcgSFRNTCBlbnRpdGllcy5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nIFRoZSBzdHJpbmcgdG8gZXNjYXBlLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGVzY2FwZWQgc3RyaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLmVzY2FwZSgnRnJlZCwgV2lsbWEsICYgUGViYmxlcycpO1xuICAgICAqIC8vID0+ICdGcmVkLCBXaWxtYSwgJmFtcDsgUGViYmxlcydcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBlc2NhcGUoc3RyaW5nKSB7XG4gICAgICByZXR1cm4gc3RyaW5nID09IG51bGwgPyAnJyA6IFN0cmluZyhzdHJpbmcpLnJlcGxhY2UocmVVbmVzY2FwZWRIdG1sLCBlc2NhcGVIdG1sQ2hhcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgcmV0dXJucyB0aGUgZmlyc3QgYXJndW1lbnQgcHJvdmlkZWQgdG8gaXQuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBBbnkgdmFsdWUuXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgYHZhbHVlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIG9iamVjdCA9IHsgJ25hbWUnOiAnZnJlZCcgfTtcbiAgICAgKiBfLmlkZW50aXR5KG9iamVjdCkgPT09IG9iamVjdDtcbiAgICAgKiAvLyA9PiB0cnVlXG4gICAgICovXG4gICAgZnVuY3Rpb24gaWRlbnRpdHkodmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGZ1bmN0aW9uIHByb3BlcnRpZXMgb2YgYSBzb3VyY2Ugb2JqZWN0IHRvIHRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAgICogSWYgYG9iamVjdGAgaXMgYSBmdW5jdGlvbiBtZXRob2RzIHdpbGwgYmUgYWRkZWQgdG8gaXRzIHByb3RvdHlwZSBhcyB3ZWxsLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fSBbb2JqZWN0PWxvZGFzaF0gb2JqZWN0IFRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBUaGUgb2JqZWN0IG9mIGZ1bmN0aW9ucyB0byBhZGQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jaGFpbj10cnVlXSBTcGVjaWZ5IHdoZXRoZXIgdGhlIGZ1bmN0aW9ucyBhZGRlZCBhcmUgY2hhaW5hYmxlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBmdW5jdGlvbiBjYXBpdGFsaXplKHN0cmluZykge1xuICAgICAqICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKS50b0xvd2VyQ2FzZSgpO1xuICAgICAqIH1cbiAgICAgKlxuICAgICAqIF8ubWl4aW4oeyAnY2FwaXRhbGl6ZSc6IGNhcGl0YWxpemUgfSk7XG4gICAgICogXy5jYXBpdGFsaXplKCdmcmVkJyk7XG4gICAgICogLy8gPT4gJ0ZyZWQnXG4gICAgICpcbiAgICAgKiBfKCdmcmVkJykuY2FwaXRhbGl6ZSgpLnZhbHVlKCk7XG4gICAgICogLy8gPT4gJ0ZyZWQnXG4gICAgICpcbiAgICAgKiBfLm1peGluKHsgJ2NhcGl0YWxpemUnOiBjYXBpdGFsaXplIH0sIHsgJ2NoYWluJzogZmFsc2UgfSk7XG4gICAgICogXygnZnJlZCcpLmNhcGl0YWxpemUoKTtcbiAgICAgKiAvLyA9PiAnRnJlZCdcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBtaXhpbihvYmplY3QsIHNvdXJjZSwgb3B0aW9ucykge1xuICAgICAgdmFyIGNoYWluID0gdHJ1ZSxcbiAgICAgICAgICBtZXRob2ROYW1lcyA9IHNvdXJjZSAmJiBmdW5jdGlvbnMoc291cmNlKTtcblxuICAgICAgaWYgKCFzb3VyY2UgfHwgKCFvcHRpb25zICYmICFtZXRob2ROYW1lcy5sZW5ndGgpKSB7XG4gICAgICAgIGlmIChvcHRpb25zID09IG51bGwpIHtcbiAgICAgICAgICBvcHRpb25zID0gc291cmNlO1xuICAgICAgICB9XG4gICAgICAgIGN0b3IgPSBsb2Rhc2hXcmFwcGVyO1xuICAgICAgICBzb3VyY2UgPSBvYmplY3Q7XG4gICAgICAgIG9iamVjdCA9IGxvZGFzaDtcbiAgICAgICAgbWV0aG9kTmFtZXMgPSBmdW5jdGlvbnMoc291cmNlKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcHRpb25zID09PSBmYWxzZSkge1xuICAgICAgICBjaGFpbiA9IGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChpc09iamVjdChvcHRpb25zKSAmJiAnY2hhaW4nIGluIG9wdGlvbnMpIHtcbiAgICAgICAgY2hhaW4gPSBvcHRpb25zLmNoYWluO1xuICAgICAgfVxuICAgICAgdmFyIGN0b3IgPSBvYmplY3QsXG4gICAgICAgICAgaXNGdW5jID0gaXNGdW5jdGlvbihjdG9yKTtcblxuICAgICAgZm9yRWFjaChtZXRob2ROYW1lcywgZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuICAgICAgICB2YXIgZnVuYyA9IG9iamVjdFttZXRob2ROYW1lXSA9IHNvdXJjZVttZXRob2ROYW1lXTtcbiAgICAgICAgaWYgKGlzRnVuYykge1xuICAgICAgICAgIGN0b3IucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgY2hhaW5BbGwgPSB0aGlzLl9fY2hhaW5fXyxcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHRoaXMuX193cmFwcGVkX18sXG4gICAgICAgICAgICAgICAgYXJncyA9IFt2YWx1ZV07XG5cbiAgICAgICAgICAgIHB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KG9iamVjdCwgYXJncyk7XG4gICAgICAgICAgICBpZiAoY2hhaW4gfHwgY2hhaW5BbGwpIHtcbiAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSByZXN1bHQgJiYgaXNPYmplY3QocmVzdWx0KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBjdG9yKHJlc3VsdCk7XG4gICAgICAgICAgICAgIHJlc3VsdC5fX2NoYWluX18gPSBjaGFpbkFsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV2ZXJ0cyB0aGUgJ18nIHZhcmlhYmxlIHRvIGl0cyBwcmV2aW91cyB2YWx1ZSBhbmQgcmV0dXJucyBhIHJlZmVyZW5jZSB0b1xuICAgICAqIHRoZSBgbG9kYXNoYCBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIGBsb2Rhc2hgIGZ1bmN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgbG9kYXNoID0gXy5ub0NvbmZsaWN0KCk7XG4gICAgICovXG4gICAgZnVuY3Rpb24gbm9Db25mbGljdCgpIHtcbiAgICAgIGNvbnRleHQuXyA9IG9sZERhc2g7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIG5vLW9wZXJhdGlvbiBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIG9iamVjdCA9IHsgJ25hbWUnOiAnZnJlZCcgfTtcbiAgICAgKiBfLm5vb3Aob2JqZWN0KSA9PT0gdW5kZWZpbmVkO1xuICAgICAqIC8vID0+IHRydWVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBub29wKCkge1xuICAgICAgLy8gbm8gb3BlcmF0aW9uIHBlcmZvcm1lZFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdGhhdCBoYXZlIGVsYXBzZWQgc2luY2UgdGhlIFVuaXggZXBvY2hcbiAgICAgKiAoMSBKYW51YXJ5IDE5NzAgMDA6MDA6MDAgVVRDKS5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIHN0YW1wID0gXy5ub3coKTtcbiAgICAgKiBfLmRlZmVyKGZ1bmN0aW9uKCkgeyBjb25zb2xlLmxvZyhfLm5vdygpIC0gc3RhbXApOyB9KTtcbiAgICAgKiAvLyA9PiBsb2dzIHRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIGl0IHRvb2sgZm9yIHRoZSBkZWZlcnJlZCBmdW5jdGlvbiB0byBiZSBjYWxsZWRcbiAgICAgKi9cbiAgICB2YXIgbm93ID0gaXNOYXRpdmUobm93ID0gRGF0ZS5ub3cpICYmIG5vdyB8fCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIGdpdmVuIHZhbHVlIGludG8gYW4gaW50ZWdlciBvZiB0aGUgc3BlY2lmaWVkIHJhZGl4LlxuICAgICAqIElmIGByYWRpeGAgaXMgYHVuZGVmaW5lZGAgb3IgYDBgIGEgYHJhZGl4YCBvZiBgMTBgIGlzIHVzZWQgdW5sZXNzIHRoZVxuICAgICAqIGB2YWx1ZWAgaXMgYSBoZXhhZGVjaW1hbCwgaW4gd2hpY2ggY2FzZSBhIGByYWRpeGAgb2YgYDE2YCBpcyB1c2VkLlxuICAgICAqXG4gICAgICogTm90ZTogVGhpcyBtZXRob2QgYXZvaWRzIGRpZmZlcmVuY2VzIGluIG5hdGl2ZSBFUzMgYW5kIEVTNSBgcGFyc2VJbnRgXG4gICAgICogaW1wbGVtZW50YXRpb25zLiBTZWUgaHR0cDovL2VzNS5naXRodWIuaW8vI0UuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIFRoZSB2YWx1ZSB0byBwYXJzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3JhZGl4XSBUaGUgcmFkaXggdXNlZCB0byBpbnRlcnByZXQgdGhlIHZhbHVlIHRvIHBhcnNlLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG5ldyBpbnRlZ2VyIHZhbHVlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLnBhcnNlSW50KCcwOCcpO1xuICAgICAqIC8vID0+IDhcbiAgICAgKi9cbiAgICB2YXIgcGFyc2VJbnQgPSBuYXRpdmVQYXJzZUludCh3aGl0ZXNwYWNlICsgJzA4JykgPT0gOCA/IG5hdGl2ZVBhcnNlSW50IDogZnVuY3Rpb24odmFsdWUsIHJhZGl4KSB7XG4gICAgICAvLyBGaXJlZm94IDwgMjEgYW5kIE9wZXJhIDwgMTUgZm9sbG93IHRoZSBFUzMgc3BlY2lmaWVkIGltcGxlbWVudGF0aW9uIG9mIGBwYXJzZUludGBcbiAgICAgIHJldHVybiBuYXRpdmVQYXJzZUludChpc1N0cmluZyh2YWx1ZSkgPyB2YWx1ZS5yZXBsYWNlKHJlTGVhZGluZ1NwYWNlc0FuZFplcm9zLCAnJykgOiB2YWx1ZSwgcmFkaXggfHwgMCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBcIl8ucGx1Y2tcIiBzdHlsZSBmdW5jdGlvbiwgd2hpY2ggcmV0dXJucyB0aGUgYGtleWAgdmFsdWUgb2YgYVxuICAgICAqIGdpdmVuIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0byByZXRyaWV2ZS5cbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICdhZ2UnOiA0MCB9LFxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfVxuICAgICAqIF07XG4gICAgICpcbiAgICAgKiB2YXIgZ2V0TmFtZSA9IF8ucHJvcGVydHkoJ25hbWUnKTtcbiAgICAgKlxuICAgICAqIF8ubWFwKGNoYXJhY3RlcnMsIGdldE5hbWUpO1xuICAgICAqIC8vID0+IFsnYmFybmV5JywgJ2ZyZWQnXVxuICAgICAqXG4gICAgICogXy5zb3J0QnkoY2hhcmFjdGVycywgZ2V0TmFtZSk7XG4gICAgICogLy8gPT4gW3sgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH0sIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1dXG4gICAgICovXG4gICAgZnVuY3Rpb24gcHJvcGVydHkoa2V5KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICAgIHJldHVybiBvYmplY3Rba2V5XTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvZHVjZXMgYSByYW5kb20gbnVtYmVyIGJldHdlZW4gYG1pbmAgYW5kIGBtYXhgIChpbmNsdXNpdmUpLiBJZiBvbmx5IG9uZVxuICAgICAqIGFyZ3VtZW50IGlzIHByb3ZpZGVkIGEgbnVtYmVyIGJldHdlZW4gYDBgIGFuZCB0aGUgZ2l2ZW4gbnVtYmVyIHdpbGwgYmVcbiAgICAgKiByZXR1cm5lZC4gSWYgYGZsb2F0aW5nYCBpcyB0cnVleSBvciBlaXRoZXIgYG1pbmAgb3IgYG1heGAgYXJlIGZsb2F0cyBhXG4gICAgICogZmxvYXRpbmctcG9pbnQgbnVtYmVyIHdpbGwgYmUgcmV0dXJuZWQgaW5zdGVhZCBvZiBhbiBpbnRlZ2VyLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWluPTBdIFRoZSBtaW5pbXVtIHBvc3NpYmxlIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWF4PTFdIFRoZSBtYXhpbXVtIHBvc3NpYmxlIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2Zsb2F0aW5nPWZhbHNlXSBTcGVjaWZ5IHJldHVybmluZyBhIGZsb2F0aW5nLXBvaW50IG51bWJlci5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIGEgcmFuZG9tIG51bWJlci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXy5yYW5kb20oMCwgNSk7XG4gICAgICogLy8gPT4gYW4gaW50ZWdlciBiZXR3ZWVuIDAgYW5kIDVcbiAgICAgKlxuICAgICAqIF8ucmFuZG9tKDUpO1xuICAgICAqIC8vID0+IGFsc28gYW4gaW50ZWdlciBiZXR3ZWVuIDAgYW5kIDVcbiAgICAgKlxuICAgICAqIF8ucmFuZG9tKDUsIHRydWUpO1xuICAgICAqIC8vID0+IGEgZmxvYXRpbmctcG9pbnQgbnVtYmVyIGJldHdlZW4gMCBhbmQgNVxuICAgICAqXG4gICAgICogXy5yYW5kb20oMS4yLCA1LjIpO1xuICAgICAqIC8vID0+IGEgZmxvYXRpbmctcG9pbnQgbnVtYmVyIGJldHdlZW4gMS4yIGFuZCA1LjJcbiAgICAgKi9cbiAgICBmdW5jdGlvbiByYW5kb20obWluLCBtYXgsIGZsb2F0aW5nKSB7XG4gICAgICB2YXIgbm9NaW4gPSBtaW4gPT0gbnVsbCxcbiAgICAgICAgICBub01heCA9IG1heCA9PSBudWxsO1xuXG4gICAgICBpZiAoZmxvYXRpbmcgPT0gbnVsbCkge1xuICAgICAgICBpZiAodHlwZW9mIG1pbiA9PSAnYm9vbGVhbicgJiYgbm9NYXgpIHtcbiAgICAgICAgICBmbG9hdGluZyA9IG1pbjtcbiAgICAgICAgICBtaW4gPSAxO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFub01heCAmJiB0eXBlb2YgbWF4ID09ICdib29sZWFuJykge1xuICAgICAgICAgIGZsb2F0aW5nID0gbWF4O1xuICAgICAgICAgIG5vTWF4ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKG5vTWluICYmIG5vTWF4KSB7XG4gICAgICAgIG1heCA9IDE7XG4gICAgICB9XG4gICAgICBtaW4gPSArbWluIHx8IDA7XG4gICAgICBpZiAobm9NYXgpIHtcbiAgICAgICAgbWF4ID0gbWluO1xuICAgICAgICBtaW4gPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWF4ID0gK21heCB8fCAwO1xuICAgICAgfVxuICAgICAgaWYgKGZsb2F0aW5nIHx8IG1pbiAlIDEgfHwgbWF4ICUgMSkge1xuICAgICAgICB2YXIgcmFuZCA9IG5hdGl2ZVJhbmRvbSgpO1xuICAgICAgICByZXR1cm4gbmF0aXZlTWluKG1pbiArIChyYW5kICogKG1heCAtIG1pbiArIHBhcnNlRmxvYXQoJzFlLScgKyAoKHJhbmQgKycnKS5sZW5ndGggLSAxKSkpKSwgbWF4KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBiYXNlUmFuZG9tKG1pbiwgbWF4KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlcyB0aGUgdmFsdWUgb2YgcHJvcGVydHkgYGtleWAgb24gYG9iamVjdGAuIElmIGBrZXlgIGlzIGEgZnVuY3Rpb25cbiAgICAgKiBpdCB3aWxsIGJlIGludm9rZWQgd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgYG9iamVjdGAgYW5kIGl0cyByZXN1bHQgcmV0dXJuZWQsXG4gICAgICogZWxzZSB0aGUgcHJvcGVydHkgdmFsdWUgaXMgcmV0dXJuZWQuIElmIGBvYmplY3RgIGlzIGZhbHNleSB0aGVuIGB1bmRlZmluZWRgXG4gICAgICogaXMgcmV0dXJuZWQuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdG8gcmVzb2x2ZS5cbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgcmVzb2x2ZWQgdmFsdWUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBvYmplY3QgPSB7XG4gICAgICogICAnY2hlZXNlJzogJ2NydW1wZXRzJyxcbiAgICAgKiAgICdzdHVmZic6IGZ1bmN0aW9uKCkge1xuICAgICAqICAgICByZXR1cm4gJ25vbnNlbnNlJztcbiAgICAgKiAgIH1cbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogXy5yZXN1bHQob2JqZWN0LCAnY2hlZXNlJyk7XG4gICAgICogLy8gPT4gJ2NydW1wZXRzJ1xuICAgICAqXG4gICAgICogXy5yZXN1bHQob2JqZWN0LCAnc3R1ZmYnKTtcbiAgICAgKiAvLyA9PiAnbm9uc2Vuc2UnXG4gICAgICovXG4gICAgZnVuY3Rpb24gcmVzdWx0KG9iamVjdCwga2V5KSB7XG4gICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IG9iamVjdFtrZXldO1xuICAgICAgICByZXR1cm4gaXNGdW5jdGlvbih2YWx1ZSkgPyBvYmplY3Rba2V5XSgpIDogdmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBtaWNyby10ZW1wbGF0aW5nIG1ldGhvZCB0aGF0IGhhbmRsZXMgYXJiaXRyYXJ5IGRlbGltaXRlcnMsIHByZXNlcnZlc1xuICAgICAqIHdoaXRlc3BhY2UsIGFuZCBjb3JyZWN0bHkgZXNjYXBlcyBxdW90ZXMgd2l0aGluIGludGVycG9sYXRlZCBjb2RlLlxuICAgICAqXG4gICAgICogTm90ZTogSW4gdGhlIGRldmVsb3BtZW50IGJ1aWxkLCBgXy50ZW1wbGF0ZWAgdXRpbGl6ZXMgc291cmNlVVJMcyBmb3IgZWFzaWVyXG4gICAgICogZGVidWdnaW5nLiBTZWUgaHR0cDovL3d3dy5odG1sNXJvY2tzLmNvbS9lbi90dXRvcmlhbHMvZGV2ZWxvcGVydG9vbHMvc291cmNlbWFwcy8jdG9jLXNvdXJjZXVybFxuICAgICAqXG4gICAgICogRm9yIG1vcmUgaW5mb3JtYXRpb24gb24gcHJlY29tcGlsaW5nIHRlbXBsYXRlcyBzZWU6XG4gICAgICogaHR0cDovL2xvZGFzaC5jb20vY3VzdG9tLWJ1aWxkc1xuICAgICAqXG4gICAgICogRm9yIG1vcmUgaW5mb3JtYXRpb24gb24gQ2hyb21lIGV4dGVuc2lvbiBzYW5kYm94ZXMgc2VlOlxuICAgICAqIGh0dHA6Ly9kZXZlbG9wZXIuY2hyb21lLmNvbS9zdGFibGUvZXh0ZW5zaW9ucy9zYW5kYm94aW5nRXZhbC5odG1sXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgVGhlIHRlbXBsYXRlIHRleHQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgVGhlIGRhdGEgb2JqZWN0IHVzZWQgdG8gcG9wdWxhdGUgdGhlIHRleHQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAgICogQHBhcmFtIHtSZWdFeHB9IFtvcHRpb25zLmVzY2FwZV0gVGhlIFwiZXNjYXBlXCIgZGVsaW1pdGVyLlxuICAgICAqIEBwYXJhbSB7UmVnRXhwfSBbb3B0aW9ucy5ldmFsdWF0ZV0gVGhlIFwiZXZhbHVhdGVcIiBkZWxpbWl0ZXIuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmltcG9ydHNdIEFuIG9iamVjdCB0byBpbXBvcnQgaW50byB0aGUgdGVtcGxhdGUgYXMgbG9jYWwgdmFyaWFibGVzLlxuICAgICAqIEBwYXJhbSB7UmVnRXhwfSBbb3B0aW9ucy5pbnRlcnBvbGF0ZV0gVGhlIFwiaW50ZXJwb2xhdGVcIiBkZWxpbWl0ZXIuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtzb3VyY2VVUkxdIFRoZSBzb3VyY2VVUkwgb2YgdGhlIHRlbXBsYXRlJ3MgY29tcGlsZWQgc291cmNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbdmFyaWFibGVdIFRoZSBkYXRhIG9iamVjdCB2YXJpYWJsZSBuYW1lLlxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbnxzdHJpbmd9IFJldHVybnMgYSBjb21waWxlZCBmdW5jdGlvbiB3aGVuIG5vIGBkYXRhYCBvYmplY3RcbiAgICAgKiAgaXMgZ2l2ZW4sIGVsc2UgaXQgcmV0dXJucyB0aGUgaW50ZXJwb2xhdGVkIHRleHQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIHRoZSBcImludGVycG9sYXRlXCIgZGVsaW1pdGVyIHRvIGNyZWF0ZSBhIGNvbXBpbGVkIHRlbXBsYXRlXG4gICAgICogdmFyIGNvbXBpbGVkID0gXy50ZW1wbGF0ZSgnaGVsbG8gPCU9IG5hbWUgJT4nKTtcbiAgICAgKiBjb21waWxlZCh7ICduYW1lJzogJ2ZyZWQnIH0pO1xuICAgICAqIC8vID0+ICdoZWxsbyBmcmVkJ1xuICAgICAqXG4gICAgICogLy8gdXNpbmcgdGhlIFwiZXNjYXBlXCIgZGVsaW1pdGVyIHRvIGVzY2FwZSBIVE1MIGluIGRhdGEgcHJvcGVydHkgdmFsdWVzXG4gICAgICogXy50ZW1wbGF0ZSgnPGI+PCUtIHZhbHVlICU+PC9iPicsIHsgJ3ZhbHVlJzogJzxzY3JpcHQ+JyB9KTtcbiAgICAgKiAvLyA9PiAnPGI+Jmx0O3NjcmlwdCZndDs8L2I+J1xuICAgICAqXG4gICAgICogLy8gdXNpbmcgdGhlIFwiZXZhbHVhdGVcIiBkZWxpbWl0ZXIgdG8gZ2VuZXJhdGUgSFRNTFxuICAgICAqIHZhciBsaXN0ID0gJzwlIF8uZm9yRWFjaChwZW9wbGUsIGZ1bmN0aW9uKG5hbWUpIHsgJT48bGk+PCUtIG5hbWUgJT48L2xpPjwlIH0pOyAlPic7XG4gICAgICogXy50ZW1wbGF0ZShsaXN0LCB7ICdwZW9wbGUnOiBbJ2ZyZWQnLCAnYmFybmV5J10gfSk7XG4gICAgICogLy8gPT4gJzxsaT5mcmVkPC9saT48bGk+YmFybmV5PC9saT4nXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyB0aGUgRVM2IGRlbGltaXRlciBhcyBhbiBhbHRlcm5hdGl2ZSB0byB0aGUgZGVmYXVsdCBcImludGVycG9sYXRlXCIgZGVsaW1pdGVyXG4gICAgICogXy50ZW1wbGF0ZSgnaGVsbG8gJHsgbmFtZSB9JywgeyAnbmFtZSc6ICdwZWJibGVzJyB9KTtcbiAgICAgKiAvLyA9PiAnaGVsbG8gcGViYmxlcydcbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIHRoZSBpbnRlcm5hbCBgcHJpbnRgIGZ1bmN0aW9uIGluIFwiZXZhbHVhdGVcIiBkZWxpbWl0ZXJzXG4gICAgICogXy50ZW1wbGF0ZSgnPCUgcHJpbnQoXCJoZWxsbyBcIiArIG5hbWUpOyAlPiEnLCB7ICduYW1lJzogJ2Jhcm5leScgfSk7XG4gICAgICogLy8gPT4gJ2hlbGxvIGJhcm5leSEnXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyBhIGN1c3RvbSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzXG4gICAgICogXy50ZW1wbGF0ZVNldHRpbmdzID0ge1xuICAgICAqICAgJ2ludGVycG9sYXRlJzogL3t7KFtcXHNcXFNdKz8pfX0vZ1xuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBfLnRlbXBsYXRlKCdoZWxsbyB7eyBuYW1lIH19IScsIHsgJ25hbWUnOiAnbXVzdGFjaGUnIH0pO1xuICAgICAqIC8vID0+ICdoZWxsbyBtdXN0YWNoZSEnXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyB0aGUgYGltcG9ydHNgIG9wdGlvbiB0byBpbXBvcnQgalF1ZXJ5XG4gICAgICogdmFyIGxpc3QgPSAnPCUganEuZWFjaChwZW9wbGUsIGZ1bmN0aW9uKG5hbWUpIHsgJT48bGk+PCUtIG5hbWUgJT48L2xpPjwlIH0pOyAlPic7XG4gICAgICogXy50ZW1wbGF0ZShsaXN0LCB7ICdwZW9wbGUnOiBbJ2ZyZWQnLCAnYmFybmV5J10gfSwgeyAnaW1wb3J0cyc6IHsgJ2pxJzogalF1ZXJ5IH0gfSk7XG4gICAgICogLy8gPT4gJzxsaT5mcmVkPC9saT48bGk+YmFybmV5PC9saT4nXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyB0aGUgYHNvdXJjZVVSTGAgb3B0aW9uIHRvIHNwZWNpZnkgYSBjdXN0b20gc291cmNlVVJMIGZvciB0aGUgdGVtcGxhdGVcbiAgICAgKiB2YXIgY29tcGlsZWQgPSBfLnRlbXBsYXRlKCdoZWxsbyA8JT0gbmFtZSAlPicsIG51bGwsIHsgJ3NvdXJjZVVSTCc6ICcvYmFzaWMvZ3JlZXRpbmcuanN0JyB9KTtcbiAgICAgKiBjb21waWxlZChkYXRhKTtcbiAgICAgKiAvLyA9PiBmaW5kIHRoZSBzb3VyY2Ugb2YgXCJncmVldGluZy5qc3RcIiB1bmRlciB0aGUgU291cmNlcyB0YWIgb3IgUmVzb3VyY2VzIHBhbmVsIG9mIHRoZSB3ZWIgaW5zcGVjdG9yXG4gICAgICpcbiAgICAgKiAvLyB1c2luZyB0aGUgYHZhcmlhYmxlYCBvcHRpb24gdG8gZW5zdXJlIGEgd2l0aC1zdGF0ZW1lbnQgaXNuJ3QgdXNlZCBpbiB0aGUgY29tcGlsZWQgdGVtcGxhdGVcbiAgICAgKiB2YXIgY29tcGlsZWQgPSBfLnRlbXBsYXRlKCdoaSA8JT0gZGF0YS5uYW1lICU+IScsIG51bGwsIHsgJ3ZhcmlhYmxlJzogJ2RhdGEnIH0pO1xuICAgICAqIGNvbXBpbGVkLnNvdXJjZTtcbiAgICAgKiAvLyA9PiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICogICB2YXIgX190LCBfX3AgPSAnJywgX19lID0gXy5lc2NhcGU7XG4gICAgICogICBfX3AgKz0gJ2hpICcgKyAoKF9fdCA9ICggZGF0YS5uYW1lICkpID09IG51bGwgPyAnJyA6IF9fdCkgKyAnISc7XG4gICAgICogICByZXR1cm4gX19wO1xuICAgICAqIH1cbiAgICAgKlxuICAgICAqIC8vIHVzaW5nIHRoZSBgc291cmNlYCBwcm9wZXJ0eSB0byBpbmxpbmUgY29tcGlsZWQgdGVtcGxhdGVzIGZvciBtZWFuaW5nZnVsXG4gICAgICogLy8gbGluZSBudW1iZXJzIGluIGVycm9yIG1lc3NhZ2VzIGFuZCBhIHN0YWNrIHRyYWNlXG4gICAgICogZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4oY3dkLCAnanN0LmpzJyksICdcXFxuICAgICAqICAgdmFyIEpTVCA9IHtcXFxuICAgICAqICAgICBcIm1haW5cIjogJyArIF8udGVtcGxhdGUobWFpblRleHQpLnNvdXJjZSArICdcXFxuICAgICAqICAgfTtcXFxuICAgICAqICcpO1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIHRlbXBsYXRlKHRleHQsIGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgIC8vIGJhc2VkIG9uIEpvaG4gUmVzaWcncyBgdG1wbGAgaW1wbGVtZW50YXRpb25cbiAgICAgIC8vIGh0dHA6Ly9lam9obi5vcmcvYmxvZy9qYXZhc2NyaXB0LW1pY3JvLXRlbXBsYXRpbmcvXG4gICAgICAvLyBhbmQgTGF1cmEgRG9rdG9yb3ZhJ3MgZG9ULmpzXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vb2xhZG8vZG9UXG4gICAgICB2YXIgc2V0dGluZ3MgPSBsb2Rhc2gudGVtcGxhdGVTZXR0aW5ncztcbiAgICAgIHRleHQgPSBTdHJpbmcodGV4dCB8fCAnJyk7XG5cbiAgICAgIC8vIGF2b2lkIG1pc3NpbmcgZGVwZW5kZW5jaWVzIHdoZW4gYGl0ZXJhdG9yVGVtcGxhdGVgIGlzIG5vdCBkZWZpbmVkXG4gICAgICBvcHRpb25zID0gZGVmYXVsdHMoe30sIG9wdGlvbnMsIHNldHRpbmdzKTtcblxuICAgICAgdmFyIGltcG9ydHMgPSBkZWZhdWx0cyh7fSwgb3B0aW9ucy5pbXBvcnRzLCBzZXR0aW5ncy5pbXBvcnRzKSxcbiAgICAgICAgICBpbXBvcnRzS2V5cyA9IGtleXMoaW1wb3J0cyksXG4gICAgICAgICAgaW1wb3J0c1ZhbHVlcyA9IHZhbHVlcyhpbXBvcnRzKTtcblxuICAgICAgdmFyIGlzRXZhbHVhdGluZyxcbiAgICAgICAgICBpbmRleCA9IDAsXG4gICAgICAgICAgaW50ZXJwb2xhdGUgPSBvcHRpb25zLmludGVycG9sYXRlIHx8IHJlTm9NYXRjaCxcbiAgICAgICAgICBzb3VyY2UgPSBcIl9fcCArPSAnXCI7XG5cbiAgICAgIC8vIGNvbXBpbGUgdGhlIHJlZ2V4cCB0byBtYXRjaCBlYWNoIGRlbGltaXRlclxuICAgICAgdmFyIHJlRGVsaW1pdGVycyA9IFJlZ0V4cChcbiAgICAgICAgKG9wdGlvbnMuZXNjYXBlIHx8IHJlTm9NYXRjaCkuc291cmNlICsgJ3wnICtcbiAgICAgICAgaW50ZXJwb2xhdGUuc291cmNlICsgJ3wnICtcbiAgICAgICAgKGludGVycG9sYXRlID09PSByZUludGVycG9sYXRlID8gcmVFc1RlbXBsYXRlIDogcmVOb01hdGNoKS5zb3VyY2UgKyAnfCcgK1xuICAgICAgICAob3B0aW9ucy5ldmFsdWF0ZSB8fCByZU5vTWF0Y2gpLnNvdXJjZSArICd8JCdcbiAgICAgICwgJ2cnKTtcblxuICAgICAgdGV4dC5yZXBsYWNlKHJlRGVsaW1pdGVycywgZnVuY3Rpb24obWF0Y2gsIGVzY2FwZVZhbHVlLCBpbnRlcnBvbGF0ZVZhbHVlLCBlc1RlbXBsYXRlVmFsdWUsIGV2YWx1YXRlVmFsdWUsIG9mZnNldCkge1xuICAgICAgICBpbnRlcnBvbGF0ZVZhbHVlIHx8IChpbnRlcnBvbGF0ZVZhbHVlID0gZXNUZW1wbGF0ZVZhbHVlKTtcblxuICAgICAgICAvLyBlc2NhcGUgY2hhcmFjdGVycyB0aGF0IGNhbm5vdCBiZSBpbmNsdWRlZCBpbiBzdHJpbmcgbGl0ZXJhbHNcbiAgICAgICAgc291cmNlICs9IHRleHQuc2xpY2UoaW5kZXgsIG9mZnNldCkucmVwbGFjZShyZVVuZXNjYXBlZFN0cmluZywgZXNjYXBlU3RyaW5nQ2hhcik7XG5cbiAgICAgICAgLy8gcmVwbGFjZSBkZWxpbWl0ZXJzIHdpdGggc25pcHBldHNcbiAgICAgICAgaWYgKGVzY2FwZVZhbHVlKSB7XG4gICAgICAgICAgc291cmNlICs9IFwiJyArXFxuX19lKFwiICsgZXNjYXBlVmFsdWUgKyBcIikgK1xcbidcIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZhbHVhdGVWYWx1ZSkge1xuICAgICAgICAgIGlzRXZhbHVhdGluZyA9IHRydWU7XG4gICAgICAgICAgc291cmNlICs9IFwiJztcXG5cIiArIGV2YWx1YXRlVmFsdWUgKyBcIjtcXG5fX3AgKz0gJ1wiO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpbnRlcnBvbGF0ZVZhbHVlKSB7XG4gICAgICAgICAgc291cmNlICs9IFwiJyArXFxuKChfX3QgPSAoXCIgKyBpbnRlcnBvbGF0ZVZhbHVlICsgXCIpKSA9PSBudWxsID8gJycgOiBfX3QpICtcXG4nXCI7XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXggPSBvZmZzZXQgKyBtYXRjaC5sZW5ndGg7XG5cbiAgICAgICAgLy8gdGhlIEpTIGVuZ2luZSBlbWJlZGRlZCBpbiBBZG9iZSBwcm9kdWN0cyByZXF1aXJlcyByZXR1cm5pbmcgdGhlIGBtYXRjaGBcbiAgICAgICAgLy8gc3RyaW5nIGluIG9yZGVyIHRvIHByb2R1Y2UgdGhlIGNvcnJlY3QgYG9mZnNldGAgdmFsdWVcbiAgICAgICAgcmV0dXJuIG1hdGNoO1xuICAgICAgfSk7XG5cbiAgICAgIHNvdXJjZSArPSBcIic7XFxuXCI7XG5cbiAgICAgIC8vIGlmIGB2YXJpYWJsZWAgaXMgbm90IHNwZWNpZmllZCwgd3JhcCBhIHdpdGgtc3RhdGVtZW50IGFyb3VuZCB0aGUgZ2VuZXJhdGVkXG4gICAgICAvLyBjb2RlIHRvIGFkZCB0aGUgZGF0YSBvYmplY3QgdG8gdGhlIHRvcCBvZiB0aGUgc2NvcGUgY2hhaW5cbiAgICAgIHZhciB2YXJpYWJsZSA9IG9wdGlvbnMudmFyaWFibGUsXG4gICAgICAgICAgaGFzVmFyaWFibGUgPSB2YXJpYWJsZTtcblxuICAgICAgaWYgKCFoYXNWYXJpYWJsZSkge1xuICAgICAgICB2YXJpYWJsZSA9ICdvYmonO1xuICAgICAgICBzb3VyY2UgPSAnd2l0aCAoJyArIHZhcmlhYmxlICsgJykge1xcbicgKyBzb3VyY2UgKyAnXFxufVxcbic7XG4gICAgICB9XG4gICAgICAvLyBjbGVhbnVwIGNvZGUgYnkgc3RyaXBwaW5nIGVtcHR5IHN0cmluZ3NcbiAgICAgIHNvdXJjZSA9IChpc0V2YWx1YXRpbmcgPyBzb3VyY2UucmVwbGFjZShyZUVtcHR5U3RyaW5nTGVhZGluZywgJycpIDogc291cmNlKVxuICAgICAgICAucmVwbGFjZShyZUVtcHR5U3RyaW5nTWlkZGxlLCAnJDEnKVxuICAgICAgICAucmVwbGFjZShyZUVtcHR5U3RyaW5nVHJhaWxpbmcsICckMTsnKTtcblxuICAgICAgLy8gZnJhbWUgY29kZSBhcyB0aGUgZnVuY3Rpb24gYm9keVxuICAgICAgc291cmNlID0gJ2Z1bmN0aW9uKCcgKyB2YXJpYWJsZSArICcpIHtcXG4nICtcbiAgICAgICAgKGhhc1ZhcmlhYmxlID8gJycgOiB2YXJpYWJsZSArICcgfHwgKCcgKyB2YXJpYWJsZSArICcgPSB7fSk7XFxuJykgK1xuICAgICAgICBcInZhciBfX3QsIF9fcCA9ICcnLCBfX2UgPSBfLmVzY2FwZVwiICtcbiAgICAgICAgKGlzRXZhbHVhdGluZ1xuICAgICAgICAgID8gJywgX19qID0gQXJyYXkucHJvdG90eXBlLmpvaW47XFxuJyArXG4gICAgICAgICAgICBcImZ1bmN0aW9uIHByaW50KCkgeyBfX3AgKz0gX19qLmNhbGwoYXJndW1lbnRzLCAnJykgfVxcblwiXG4gICAgICAgICAgOiAnO1xcbidcbiAgICAgICAgKSArXG4gICAgICAgIHNvdXJjZSArXG4gICAgICAgICdyZXR1cm4gX19wXFxufSc7XG5cbiAgICAgIC8vIFVzZSBhIHNvdXJjZVVSTCBmb3IgZWFzaWVyIGRlYnVnZ2luZy5cbiAgICAgIC8vIGh0dHA6Ly93d3cuaHRtbDVyb2Nrcy5jb20vZW4vdHV0b3JpYWxzL2RldmVsb3BlcnRvb2xzL3NvdXJjZW1hcHMvI3RvYy1zb3VyY2V1cmxcbiAgICAgIHZhciBzb3VyY2VVUkwgPSAnXFxuLypcXG4vLyMgc291cmNlVVJMPScgKyAob3B0aW9ucy5zb3VyY2VVUkwgfHwgJy9sb2Rhc2gvdGVtcGxhdGUvc291cmNlWycgKyAodGVtcGxhdGVDb3VudGVyKyspICsgJ10nKSArICdcXG4qLyc7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBGdW5jdGlvbihpbXBvcnRzS2V5cywgJ3JldHVybiAnICsgc291cmNlICsgc291cmNlVVJMKS5hcHBseSh1bmRlZmluZWQsIGltcG9ydHNWYWx1ZXMpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGUuc291cmNlID0gc291cmNlO1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdChkYXRhKTtcbiAgICAgIH1cbiAgICAgIC8vIHByb3ZpZGUgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uJ3Mgc291cmNlIGJ5IGl0cyBgdG9TdHJpbmdgIG1ldGhvZCwgaW5cbiAgICAgIC8vIHN1cHBvcnRlZCBlbnZpcm9ubWVudHMsIG9yIHRoZSBgc291cmNlYCBwcm9wZXJ0eSBhcyBhIGNvbnZlbmllbmNlIGZvclxuICAgICAgLy8gaW5saW5pbmcgY29tcGlsZWQgdGVtcGxhdGVzIGR1cmluZyB0aGUgYnVpbGQgcHJvY2Vzc1xuICAgICAgcmVzdWx0LnNvdXJjZSA9IHNvdXJjZTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZXMgdGhlIGNhbGxiYWNrIGBuYCB0aW1lcywgcmV0dXJuaW5nIGFuIGFycmF5IG9mIHRoZSByZXN1bHRzXG4gICAgICogb2YgZWFjaCBjYWxsYmFjayBleGVjdXRpb24uIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWRcbiAgICAgKiB3aXRoIG9uZSBhcmd1bWVudDsgKGluZGV4KS5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBUaGUgbnVtYmVyIG9mIHRpbWVzIHRvIGV4ZWN1dGUgdGhlIGNhbGxiYWNrLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYW4gYXJyYXkgb2YgdGhlIHJlc3VsdHMgb2YgZWFjaCBgY2FsbGJhY2tgIGV4ZWN1dGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIGRpY2VSb2xscyA9IF8udGltZXMoMywgXy5wYXJ0aWFsKF8ucmFuZG9tLCAxLCA2KSk7XG4gICAgICogLy8gPT4gWzMsIDYsIDRdXG4gICAgICpcbiAgICAgKiBfLnRpbWVzKDMsIGZ1bmN0aW9uKG4pIHsgbWFnZS5jYXN0U3BlbGwobik7IH0pO1xuICAgICAqIC8vID0+IGNhbGxzIGBtYWdlLmNhc3RTcGVsbChuKWAgdGhyZWUgdGltZXMsIHBhc3NpbmcgYG5gIG9mIGAwYCwgYDFgLCBhbmQgYDJgIHJlc3BlY3RpdmVseVxuICAgICAqXG4gICAgICogXy50aW1lcygzLCBmdW5jdGlvbihuKSB7IHRoaXMuY2FzdChuKTsgfSwgbWFnZSk7XG4gICAgICogLy8gPT4gYWxzbyBjYWxscyBgbWFnZS5jYXN0U3BlbGwobilgIHRocmVlIHRpbWVzXG4gICAgICovXG4gICAgZnVuY3Rpb24gdGltZXMobiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgIG4gPSAobiA9ICtuKSA+IC0xID8gbiA6IDA7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICByZXN1bHQgPSBBcnJheShuKTtcblxuICAgICAgY2FsbGJhY2sgPSBiYXNlQ3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDEpO1xuICAgICAgd2hpbGUgKCsraW5kZXggPCBuKSB7XG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBjYWxsYmFjayhpbmRleCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBpbnZlcnNlIG9mIGBfLmVzY2FwZWAgdGhpcyBtZXRob2QgY29udmVydHMgdGhlIEhUTUwgZW50aXRpZXNcbiAgICAgKiBgJmFtcDtgLCBgJmx0O2AsIGAmZ3Q7YCwgYCZxdW90O2AsIGFuZCBgJiMzOTtgIGluIGBzdHJpbmdgIHRvIHRoZWlyXG4gICAgICogY29ycmVzcG9uZGluZyBjaGFyYWN0ZXJzLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdHJpbmcgVGhlIHN0cmluZyB0byB1bmVzY2FwZS5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSB1bmVzY2FwZWQgc3RyaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLnVuZXNjYXBlKCdGcmVkLCBCYXJuZXkgJmFtcDsgUGViYmxlcycpO1xuICAgICAqIC8vID0+ICdGcmVkLCBCYXJuZXkgJiBQZWJibGVzJ1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIHVuZXNjYXBlKHN0cmluZykge1xuICAgICAgcmV0dXJuIHN0cmluZyA9PSBudWxsID8gJycgOiBTdHJpbmcoc3RyaW5nKS5yZXBsYWNlKHJlRXNjYXBlZEh0bWwsIHVuZXNjYXBlSHRtbENoYXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlcyBhIHVuaXF1ZSBJRC4gSWYgYHByZWZpeGAgaXMgcHJvdmlkZWQgdGhlIElEIHdpbGwgYmUgYXBwZW5kZWQgdG8gaXQuXG4gICAgICpcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtwcmVmaXhdIFRoZSB2YWx1ZSB0byBwcmVmaXggdGhlIElEIHdpdGguXG4gICAgICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgdW5pcXVlIElELlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBfLnVuaXF1ZUlkKCdjb250YWN0XycpO1xuICAgICAqIC8vID0+ICdjb250YWN0XzEwNCdcbiAgICAgKlxuICAgICAqIF8udW5pcXVlSWQoKTtcbiAgICAgKiAvLyA9PiAnMTA1J1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIHVuaXF1ZUlkKHByZWZpeCkge1xuICAgICAgdmFyIGlkID0gKytpZENvdW50ZXI7XG4gICAgICByZXR1cm4gU3RyaW5nKHByZWZpeCA9PSBudWxsID8gJycgOiBwcmVmaXgpICsgaWQ7XG4gICAgfVxuXG4gICAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgYGxvZGFzaGAgb2JqZWN0IHRoYXQgd3JhcHMgdGhlIGdpdmVuIHZhbHVlIHdpdGggZXhwbGljaXRcbiAgICAgKiBtZXRob2QgY2hhaW5pbmcgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHdyYXAuXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgd3JhcHBlciBvYmplY3QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAgJ2FnZSc6IDM2IH0sXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICAnYWdlJzogNDAgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAncGViYmxlcycsICdhZ2UnOiAxIH1cbiAgICAgKiBdO1xuICAgICAqXG4gICAgICogdmFyIHlvdW5nZXN0ID0gXy5jaGFpbihjaGFyYWN0ZXJzKVxuICAgICAqICAgICAuc29ydEJ5KCdhZ2UnKVxuICAgICAqICAgICAubWFwKGZ1bmN0aW9uKGNocikgeyByZXR1cm4gY2hyLm5hbWUgKyAnIGlzICcgKyBjaHIuYWdlOyB9KVxuICAgICAqICAgICAuZmlyc3QoKVxuICAgICAqICAgICAudmFsdWUoKTtcbiAgICAgKiAvLyA9PiAncGViYmxlcyBpcyAxJ1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIGNoYWluKHZhbHVlKSB7XG4gICAgICB2YWx1ZSA9IG5ldyBsb2Rhc2hXcmFwcGVyKHZhbHVlKTtcbiAgICAgIHZhbHVlLl9fY2hhaW5fXyA9IHRydWU7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW52b2tlcyBgaW50ZXJjZXB0b3JgIHdpdGggdGhlIGB2YWx1ZWAgYXMgdGhlIGZpcnN0IGFyZ3VtZW50IGFuZCB0aGVuXG4gICAgICogcmV0dXJucyBgdmFsdWVgLiBUaGUgcHVycG9zZSBvZiB0aGlzIG1ldGhvZCBpcyB0byBcInRhcCBpbnRvXCIgYSBtZXRob2RcbiAgICAgKiBjaGFpbiBpbiBvcmRlciB0byBwZXJmb3JtIG9wZXJhdGlvbnMgb24gaW50ZXJtZWRpYXRlIHJlc3VsdHMgd2l0aGluXG4gICAgICogdGhlIGNoYWluLlxuICAgICAqXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGNhdGVnb3J5IENoYWluaW5nXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcHJvdmlkZSB0byBgaW50ZXJjZXB0b3JgLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGludGVyY2VwdG9yIFRoZSBmdW5jdGlvbiB0byBpbnZva2UuXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgYHZhbHVlYC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogXyhbMSwgMiwgMywgNF0pXG4gICAgICogIC50YXAoZnVuY3Rpb24oYXJyYXkpIHsgYXJyYXkucG9wKCk7IH0pXG4gICAgICogIC5yZXZlcnNlKClcbiAgICAgKiAgLnZhbHVlKCk7XG4gICAgICogLy8gPT4gWzMsIDIsIDFdXG4gICAgICovXG4gICAgZnVuY3Rpb24gdGFwKHZhbHVlLCBpbnRlcmNlcHRvcikge1xuICAgICAgaW50ZXJjZXB0b3IodmFsdWUpO1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgZXhwbGljaXQgbWV0aG9kIGNoYWluaW5nIG9uIHRoZSB3cmFwcGVyIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBuYW1lIGNoYWluXG4gICAgICogQG1lbWJlck9mIF9cbiAgICAgKiBAY2F0ZWdvcnkgQ2hhaW5pbmdcbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgd3JhcHBlciBvYmplY3QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfSxcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cbiAgICAgKiBdO1xuICAgICAqXG4gICAgICogLy8gd2l0aG91dCBleHBsaWNpdCBjaGFpbmluZ1xuICAgICAqIF8oY2hhcmFjdGVycykuZmlyc3QoKTtcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9XG4gICAgICpcbiAgICAgKiAvLyB3aXRoIGV4cGxpY2l0IGNoYWluaW5nXG4gICAgICogXyhjaGFyYWN0ZXJzKS5jaGFpbigpXG4gICAgICogICAuZmlyc3QoKVxuICAgICAqICAgLnBpY2soJ2FnZScpXG4gICAgICogICAudmFsdWUoKTtcbiAgICAgKiAvLyA9PiB7ICdhZ2UnOiAzNiB9XG4gICAgICovXG4gICAgZnVuY3Rpb24gd3JhcHBlckNoYWluKCkge1xuICAgICAgdGhpcy5fX2NoYWluX18gPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvZHVjZXMgdGhlIGB0b1N0cmluZ2AgcmVzdWx0IG9mIHRoZSB3cmFwcGVkIHZhbHVlLlxuICAgICAqXG4gICAgICogQG5hbWUgdG9TdHJpbmdcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIHN0cmluZyByZXN1bHQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8oWzEsIDIsIDNdKS50b1N0cmluZygpO1xuICAgICAqIC8vID0+ICcxLDIsMydcbiAgICAgKi9cbiAgICBmdW5jdGlvbiB3cmFwcGVyVG9TdHJpbmcoKSB7XG4gICAgICByZXR1cm4gU3RyaW5nKHRoaXMuX193cmFwcGVkX18pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSB3cmFwcGVkIHZhbHVlLlxuICAgICAqXG4gICAgICogQG5hbWUgdmFsdWVPZlxuICAgICAqIEBtZW1iZXJPZiBfXG4gICAgICogQGFsaWFzIHZhbHVlXG4gICAgICogQGNhdGVnb3J5IENoYWluaW5nXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIHdyYXBwZWQgdmFsdWUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIF8oWzEsIDIsIDNdKS52YWx1ZU9mKCk7XG4gICAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAgICovXG4gICAgZnVuY3Rpb24gd3JhcHBlclZhbHVlT2YoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fX3dyYXBwZWRfXztcbiAgICB9XG5cbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAgIC8vIGFkZCBmdW5jdGlvbnMgdGhhdCByZXR1cm4gd3JhcHBlZCB2YWx1ZXMgd2hlbiBjaGFpbmluZ1xuICAgIGxvZGFzaC5hZnRlciA9IGFmdGVyO1xuICAgIGxvZGFzaC5hc3NpZ24gPSBhc3NpZ247XG4gICAgbG9kYXNoLmF0ID0gYXQ7XG4gICAgbG9kYXNoLmJpbmQgPSBiaW5kO1xuICAgIGxvZGFzaC5iaW5kQWxsID0gYmluZEFsbDtcbiAgICBsb2Rhc2guYmluZEtleSA9IGJpbmRLZXk7XG4gICAgbG9kYXNoLmNoYWluID0gY2hhaW47XG4gICAgbG9kYXNoLmNvbXBhY3QgPSBjb21wYWN0O1xuICAgIGxvZGFzaC5jb21wb3NlID0gY29tcG9zZTtcbiAgICBsb2Rhc2guY29uc3RhbnQgPSBjb25zdGFudDtcbiAgICBsb2Rhc2guY291bnRCeSA9IGNvdW50Qnk7XG4gICAgbG9kYXNoLmNyZWF0ZSA9IGNyZWF0ZTtcbiAgICBsb2Rhc2guY3JlYXRlQ2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjaztcbiAgICBsb2Rhc2guY3VycnkgPSBjdXJyeTtcbiAgICBsb2Rhc2guZGVib3VuY2UgPSBkZWJvdW5jZTtcbiAgICBsb2Rhc2guZGVmYXVsdHMgPSBkZWZhdWx0cztcbiAgICBsb2Rhc2guZGVmZXIgPSBkZWZlcjtcbiAgICBsb2Rhc2guZGVsYXkgPSBkZWxheTtcbiAgICBsb2Rhc2guZGlmZmVyZW5jZSA9IGRpZmZlcmVuY2U7XG4gICAgbG9kYXNoLmZpbHRlciA9IGZpbHRlcjtcbiAgICBsb2Rhc2guZmxhdHRlbiA9IGZsYXR0ZW47XG4gICAgbG9kYXNoLmZvckVhY2ggPSBmb3JFYWNoO1xuICAgIGxvZGFzaC5mb3JFYWNoUmlnaHQgPSBmb3JFYWNoUmlnaHQ7XG4gICAgbG9kYXNoLmZvckluID0gZm9ySW47XG4gICAgbG9kYXNoLmZvckluUmlnaHQgPSBmb3JJblJpZ2h0O1xuICAgIGxvZGFzaC5mb3JPd24gPSBmb3JPd247XG4gICAgbG9kYXNoLmZvck93blJpZ2h0ID0gZm9yT3duUmlnaHQ7XG4gICAgbG9kYXNoLmZ1bmN0aW9ucyA9IGZ1bmN0aW9ucztcbiAgICBsb2Rhc2guZ3JvdXBCeSA9IGdyb3VwQnk7XG4gICAgbG9kYXNoLmluZGV4QnkgPSBpbmRleEJ5O1xuICAgIGxvZGFzaC5pbml0aWFsID0gaW5pdGlhbDtcbiAgICBsb2Rhc2guaW50ZXJzZWN0aW9uID0gaW50ZXJzZWN0aW9uO1xuICAgIGxvZGFzaC5pbnZlcnQgPSBpbnZlcnQ7XG4gICAgbG9kYXNoLmludm9rZSA9IGludm9rZTtcbiAgICBsb2Rhc2gua2V5cyA9IGtleXM7XG4gICAgbG9kYXNoLm1hcCA9IG1hcDtcbiAgICBsb2Rhc2gubWFwVmFsdWVzID0gbWFwVmFsdWVzO1xuICAgIGxvZGFzaC5tYXggPSBtYXg7XG4gICAgbG9kYXNoLm1lbW9pemUgPSBtZW1vaXplO1xuICAgIGxvZGFzaC5tZXJnZSA9IG1lcmdlO1xuICAgIGxvZGFzaC5taW4gPSBtaW47XG4gICAgbG9kYXNoLm9taXQgPSBvbWl0O1xuICAgIGxvZGFzaC5vbmNlID0gb25jZTtcbiAgICBsb2Rhc2gucGFpcnMgPSBwYWlycztcbiAgICBsb2Rhc2gucGFydGlhbCA9IHBhcnRpYWw7XG4gICAgbG9kYXNoLnBhcnRpYWxSaWdodCA9IHBhcnRpYWxSaWdodDtcbiAgICBsb2Rhc2gucGljayA9IHBpY2s7XG4gICAgbG9kYXNoLnBsdWNrID0gcGx1Y2s7XG4gICAgbG9kYXNoLnByb3BlcnR5ID0gcHJvcGVydHk7XG4gICAgbG9kYXNoLnB1bGwgPSBwdWxsO1xuICAgIGxvZGFzaC5yYW5nZSA9IHJhbmdlO1xuICAgIGxvZGFzaC5yZWplY3QgPSByZWplY3Q7XG4gICAgbG9kYXNoLnJlbW92ZSA9IHJlbW92ZTtcbiAgICBsb2Rhc2gucmVzdCA9IHJlc3Q7XG4gICAgbG9kYXNoLnNodWZmbGUgPSBzaHVmZmxlO1xuICAgIGxvZGFzaC5zb3J0QnkgPSBzb3J0Qnk7XG4gICAgbG9kYXNoLnRhcCA9IHRhcDtcbiAgICBsb2Rhc2gudGhyb3R0bGUgPSB0aHJvdHRsZTtcbiAgICBsb2Rhc2gudGltZXMgPSB0aW1lcztcbiAgICBsb2Rhc2gudG9BcnJheSA9IHRvQXJyYXk7XG4gICAgbG9kYXNoLnRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICBsb2Rhc2gudW5pb24gPSB1bmlvbjtcbiAgICBsb2Rhc2gudW5pcSA9IHVuaXE7XG4gICAgbG9kYXNoLnZhbHVlcyA9IHZhbHVlcztcbiAgICBsb2Rhc2gud2hlcmUgPSB3aGVyZTtcbiAgICBsb2Rhc2gud2l0aG91dCA9IHdpdGhvdXQ7XG4gICAgbG9kYXNoLndyYXAgPSB3cmFwO1xuICAgIGxvZGFzaC54b3IgPSB4b3I7XG4gICAgbG9kYXNoLnppcCA9IHppcDtcbiAgICBsb2Rhc2guemlwT2JqZWN0ID0gemlwT2JqZWN0O1xuXG4gICAgLy8gYWRkIGFsaWFzZXNcbiAgICBsb2Rhc2guY29sbGVjdCA9IG1hcDtcbiAgICBsb2Rhc2guZHJvcCA9IHJlc3Q7XG4gICAgbG9kYXNoLmVhY2ggPSBmb3JFYWNoO1xuICAgIGxvZGFzaC5lYWNoUmlnaHQgPSBmb3JFYWNoUmlnaHQ7XG4gICAgbG9kYXNoLmV4dGVuZCA9IGFzc2lnbjtcbiAgICBsb2Rhc2gubWV0aG9kcyA9IGZ1bmN0aW9ucztcbiAgICBsb2Rhc2gub2JqZWN0ID0gemlwT2JqZWN0O1xuICAgIGxvZGFzaC5zZWxlY3QgPSBmaWx0ZXI7XG4gICAgbG9kYXNoLnRhaWwgPSByZXN0O1xuICAgIGxvZGFzaC51bmlxdWUgPSB1bmlxO1xuICAgIGxvZGFzaC51bnppcCA9IHppcDtcblxuICAgIC8vIGFkZCBmdW5jdGlvbnMgdG8gYGxvZGFzaC5wcm90b3R5cGVgXG4gICAgbWl4aW4obG9kYXNoKTtcblxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gICAgLy8gYWRkIGZ1bmN0aW9ucyB0aGF0IHJldHVybiB1bndyYXBwZWQgdmFsdWVzIHdoZW4gY2hhaW5pbmdcbiAgICBsb2Rhc2guY2xvbmUgPSBjbG9uZTtcbiAgICBsb2Rhc2guY2xvbmVEZWVwID0gY2xvbmVEZWVwO1xuICAgIGxvZGFzaC5jb250YWlucyA9IGNvbnRhaW5zO1xuICAgIGxvZGFzaC5lc2NhcGUgPSBlc2NhcGU7XG4gICAgbG9kYXNoLmV2ZXJ5ID0gZXZlcnk7XG4gICAgbG9kYXNoLmZpbmQgPSBmaW5kO1xuICAgIGxvZGFzaC5maW5kSW5kZXggPSBmaW5kSW5kZXg7XG4gICAgbG9kYXNoLmZpbmRLZXkgPSBmaW5kS2V5O1xuICAgIGxvZGFzaC5maW5kTGFzdCA9IGZpbmRMYXN0O1xuICAgIGxvZGFzaC5maW5kTGFzdEluZGV4ID0gZmluZExhc3RJbmRleDtcbiAgICBsb2Rhc2guZmluZExhc3RLZXkgPSBmaW5kTGFzdEtleTtcbiAgICBsb2Rhc2guaGFzID0gaGFzO1xuICAgIGxvZGFzaC5pZGVudGl0eSA9IGlkZW50aXR5O1xuICAgIGxvZGFzaC5pbmRleE9mID0gaW5kZXhPZjtcbiAgICBsb2Rhc2guaXNBcmd1bWVudHMgPSBpc0FyZ3VtZW50cztcbiAgICBsb2Rhc2guaXNBcnJheSA9IGlzQXJyYXk7XG4gICAgbG9kYXNoLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcbiAgICBsb2Rhc2guaXNEYXRlID0gaXNEYXRlO1xuICAgIGxvZGFzaC5pc0VsZW1lbnQgPSBpc0VsZW1lbnQ7XG4gICAgbG9kYXNoLmlzRW1wdHkgPSBpc0VtcHR5O1xuICAgIGxvZGFzaC5pc0VxdWFsID0gaXNFcXVhbDtcbiAgICBsb2Rhc2guaXNGaW5pdGUgPSBpc0Zpbml0ZTtcbiAgICBsb2Rhc2guaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG4gICAgbG9kYXNoLmlzTmFOID0gaXNOYU47XG4gICAgbG9kYXNoLmlzTnVsbCA9IGlzTnVsbDtcbiAgICBsb2Rhc2guaXNOdW1iZXIgPSBpc051bWJlcjtcbiAgICBsb2Rhc2guaXNPYmplY3QgPSBpc09iamVjdDtcbiAgICBsb2Rhc2guaXNQbGFpbk9iamVjdCA9IGlzUGxhaW5PYmplY3Q7XG4gICAgbG9kYXNoLmlzUmVnRXhwID0gaXNSZWdFeHA7XG4gICAgbG9kYXNoLmlzU3RyaW5nID0gaXNTdHJpbmc7XG4gICAgbG9kYXNoLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG4gICAgbG9kYXNoLmxhc3RJbmRleE9mID0gbGFzdEluZGV4T2Y7XG4gICAgbG9kYXNoLm1peGluID0gbWl4aW47XG4gICAgbG9kYXNoLm5vQ29uZmxpY3QgPSBub0NvbmZsaWN0O1xuICAgIGxvZGFzaC5ub29wID0gbm9vcDtcbiAgICBsb2Rhc2gubm93ID0gbm93O1xuICAgIGxvZGFzaC5wYXJzZUludCA9IHBhcnNlSW50O1xuICAgIGxvZGFzaC5yYW5kb20gPSByYW5kb207XG4gICAgbG9kYXNoLnJlZHVjZSA9IHJlZHVjZTtcbiAgICBsb2Rhc2gucmVkdWNlUmlnaHQgPSByZWR1Y2VSaWdodDtcbiAgICBsb2Rhc2gucmVzdWx0ID0gcmVzdWx0O1xuICAgIGxvZGFzaC5ydW5JbkNvbnRleHQgPSBydW5JbkNvbnRleHQ7XG4gICAgbG9kYXNoLnNpemUgPSBzaXplO1xuICAgIGxvZGFzaC5zb21lID0gc29tZTtcbiAgICBsb2Rhc2guc29ydGVkSW5kZXggPSBzb3J0ZWRJbmRleDtcbiAgICBsb2Rhc2gudGVtcGxhdGUgPSB0ZW1wbGF0ZTtcbiAgICBsb2Rhc2gudW5lc2NhcGUgPSB1bmVzY2FwZTtcbiAgICBsb2Rhc2gudW5pcXVlSWQgPSB1bmlxdWVJZDtcblxuICAgIC8vIGFkZCBhbGlhc2VzXG4gICAgbG9kYXNoLmFsbCA9IGV2ZXJ5O1xuICAgIGxvZGFzaC5hbnkgPSBzb21lO1xuICAgIGxvZGFzaC5kZXRlY3QgPSBmaW5kO1xuICAgIGxvZGFzaC5maW5kV2hlcmUgPSBmaW5kO1xuICAgIGxvZGFzaC5mb2xkbCA9IHJlZHVjZTtcbiAgICBsb2Rhc2guZm9sZHIgPSByZWR1Y2VSaWdodDtcbiAgICBsb2Rhc2guaW5jbHVkZSA9IGNvbnRhaW5zO1xuICAgIGxvZGFzaC5pbmplY3QgPSByZWR1Y2U7XG5cbiAgICBtaXhpbihmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzb3VyY2UgPSB7fVxuICAgICAgZm9yT3duKGxvZGFzaCwgZnVuY3Rpb24oZnVuYywgbWV0aG9kTmFtZSkge1xuICAgICAgICBpZiAoIWxvZGFzaC5wcm90b3R5cGVbbWV0aG9kTmFtZV0pIHtcbiAgICAgICAgICBzb3VyY2VbbWV0aG9kTmFtZV0gPSBmdW5jO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgfSgpLCBmYWxzZSk7XG5cbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAgIC8vIGFkZCBmdW5jdGlvbnMgY2FwYWJsZSBvZiByZXR1cm5pbmcgd3JhcHBlZCBhbmQgdW53cmFwcGVkIHZhbHVlcyB3aGVuIGNoYWluaW5nXG4gICAgbG9kYXNoLmZpcnN0ID0gZmlyc3Q7XG4gICAgbG9kYXNoLmxhc3QgPSBsYXN0O1xuICAgIGxvZGFzaC5zYW1wbGUgPSBzYW1wbGU7XG5cbiAgICAvLyBhZGQgYWxpYXNlc1xuICAgIGxvZGFzaC50YWtlID0gZmlyc3Q7XG4gICAgbG9kYXNoLmhlYWQgPSBmaXJzdDtcblxuICAgIGZvck93bihsb2Rhc2gsIGZ1bmN0aW9uKGZ1bmMsIG1ldGhvZE5hbWUpIHtcbiAgICAgIHZhciBjYWxsYmFja2FibGUgPSBtZXRob2ROYW1lICE9PSAnc2FtcGxlJztcbiAgICAgIGlmICghbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSkge1xuICAgICAgICBsb2Rhc2gucHJvdG90eXBlW21ldGhvZE5hbWVdPSBmdW5jdGlvbihuLCBndWFyZCkge1xuICAgICAgICAgIHZhciBjaGFpbkFsbCA9IHRoaXMuX19jaGFpbl9fLFxuICAgICAgICAgICAgICByZXN1bHQgPSBmdW5jKHRoaXMuX193cmFwcGVkX18sIG4sIGd1YXJkKTtcblxuICAgICAgICAgIHJldHVybiAhY2hhaW5BbGwgJiYgKG4gPT0gbnVsbCB8fCAoZ3VhcmQgJiYgIShjYWxsYmFja2FibGUgJiYgdHlwZW9mIG4gPT0gJ2Z1bmN0aW9uJykpKVxuICAgICAgICAgICAgPyByZXN1bHRcbiAgICAgICAgICAgIDogbmV3IGxvZGFzaFdyYXBwZXIocmVzdWx0LCBjaGFpbkFsbCk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAgIC8qKlxuICAgICAqIFRoZSBzZW1hbnRpYyB2ZXJzaW9uIG51bWJlci5cbiAgICAgKlxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbWVtYmVyT2YgX1xuICAgICAqIEB0eXBlIHN0cmluZ1xuICAgICAqL1xuICAgIGxvZGFzaC5WRVJTSU9OID0gJzIuNC4xJztcblxuICAgIC8vIGFkZCBcIkNoYWluaW5nXCIgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyXG4gICAgbG9kYXNoLnByb3RvdHlwZS5jaGFpbiA9IHdyYXBwZXJDaGFpbjtcbiAgICBsb2Rhc2gucHJvdG90eXBlLnRvU3RyaW5nID0gd3JhcHBlclRvU3RyaW5nO1xuICAgIGxvZGFzaC5wcm90b3R5cGUudmFsdWUgPSB3cmFwcGVyVmFsdWVPZjtcbiAgICBsb2Rhc2gucHJvdG90eXBlLnZhbHVlT2YgPSB3cmFwcGVyVmFsdWVPZjtcblxuICAgIC8vIGFkZCBgQXJyYXlgIGZ1bmN0aW9ucyB0aGF0IHJldHVybiB1bndyYXBwZWQgdmFsdWVzXG4gICAgZm9yRWFjaChbJ2pvaW4nLCAncG9wJywgJ3NoaWZ0J10sIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICAgIHZhciBmdW5jID0gYXJyYXlSZWZbbWV0aG9kTmFtZV07XG4gICAgICBsb2Rhc2gucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjaGFpbkFsbCA9IHRoaXMuX19jaGFpbl9fLFxuICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzLl9fd3JhcHBlZF9fLCBhcmd1bWVudHMpO1xuXG4gICAgICAgIHJldHVybiBjaGFpbkFsbFxuICAgICAgICAgID8gbmV3IGxvZGFzaFdyYXBwZXIocmVzdWx0LCBjaGFpbkFsbClcbiAgICAgICAgICA6IHJlc3VsdDtcbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICAvLyBhZGQgYEFycmF5YCBmdW5jdGlvbnMgdGhhdCByZXR1cm4gdGhlIGV4aXN0aW5nIHdyYXBwZWQgdmFsdWVcbiAgICBmb3JFYWNoKFsncHVzaCcsICdyZXZlcnNlJywgJ3NvcnQnLCAndW5zaGlmdCddLCBmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgICB2YXIgZnVuYyA9IGFycmF5UmVmW21ldGhvZE5hbWVdO1xuICAgICAgbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBmdW5jLmFwcGx5KHRoaXMuX193cmFwcGVkX18sIGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfTtcbiAgICB9KTtcblxuICAgIC8vIGFkZCBgQXJyYXlgIGZ1bmN0aW9ucyB0aGF0IHJldHVybiBuZXcgd3JhcHBlZCB2YWx1ZXNcbiAgICBmb3JFYWNoKFsnY29uY2F0JywgJ3NsaWNlJywgJ3NwbGljZSddLCBmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgICB2YXIgZnVuYyA9IGFycmF5UmVmW21ldGhvZE5hbWVdO1xuICAgICAgbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbmV3IGxvZGFzaFdyYXBwZXIoZnVuYy5hcHBseSh0aGlzLl9fd3JhcHBlZF9fLCBhcmd1bWVudHMpLCB0aGlzLl9fY2hhaW5fXyk7XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGxvZGFzaDtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIGV4cG9zZSBMby1EYXNoXG4gIHZhciBfID0gcnVuSW5Db250ZXh0KCk7XG5cbiAgLy8gc29tZSBBTUQgYnVpbGQgb3B0aW1pemVycyBsaWtlIHIuanMgY2hlY2sgZm9yIGNvbmRpdGlvbiBwYXR0ZXJucyBsaWtlIHRoZSBmb2xsb3dpbmc6XG4gIGlmICh0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIEV4cG9zZSBMby1EYXNoIHRvIHRoZSBnbG9iYWwgb2JqZWN0IGV2ZW4gd2hlbiBhbiBBTUQgbG9hZGVyIGlzIHByZXNlbnQgaW5cbiAgICAvLyBjYXNlIExvLURhc2ggaXMgbG9hZGVkIHdpdGggYSBSZXF1aXJlSlMgc2hpbSBjb25maWcuXG4gICAgLy8gU2VlIGh0dHA6Ly9yZXF1aXJlanMub3JnL2RvY3MvYXBpLmh0bWwjY29uZmlnLXNoaW1cbiAgICByb290Ll8gPSBfO1xuXG4gICAgLy8gZGVmaW5lIGFzIGFuIGFub255bW91cyBtb2R1bGUgc28sIHRocm91Z2ggcGF0aCBtYXBwaW5nLCBpdCBjYW4gYmVcbiAgICAvLyByZWZlcmVuY2VkIGFzIHRoZSBcInVuZGVyc2NvcmVcIiBtb2R1bGVcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gXztcbiAgICB9KTtcbiAgfVxuICAvLyBjaGVjayBmb3IgYGV4cG9ydHNgIGFmdGVyIGBkZWZpbmVgIGluIGNhc2UgYSBidWlsZCBvcHRpbWl6ZXIgYWRkcyBhbiBgZXhwb3J0c2Agb2JqZWN0XG4gIGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcbiAgICAvLyBpbiBOb2RlLmpzIG9yIFJpbmdvSlNcbiAgICBpZiAobW9kdWxlRXhwb3J0cykge1xuICAgICAgKGZyZWVNb2R1bGUuZXhwb3J0cyA9IF8pLl8gPSBfO1xuICAgIH1cbiAgICAvLyBpbiBOYXJ3aGFsIG9yIFJoaW5vIC1yZXF1aXJlXG4gICAgZWxzZSB7XG4gICAgICBmcmVlRXhwb3J0cy5fID0gXztcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gaW4gYSBicm93c2VyIG9yIFJoaW5vXG4gICAgcm9vdC5fID0gXztcbiAgfVxufS5jYWxsKHRoaXMpKTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLlxcXFwuLlxcXFwuLlxcXFxub2RlX21vZHVsZXNcXFxcbG9kYXNoXFxcXGRpc3RcXFxcbG9kYXNoLmpzXCIsXCIvLi5cXFxcLi5cXFxcLi5cXFxcbm9kZV9tb2R1bGVzXFxcXGxvZGFzaFxcXFxkaXN0XCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIHN0YXJ0VGltZSA9IG5ldyBEYXRlKCksXHJcbiAgICBnYW1lUm9vbUlELFxyXG4gICAgaXNIb3N0LFxyXG4gICAgY29udHJvbE1vZGUsXHJcbiAgICBzdGF0ZSA9ICd3YWl0aW5nJztcclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcblx0c29ja2V0c01hbmFnZXIuaW5pdCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRTdGFydFRpbWUoKSB7XHJcbiAgICByZXR1cm4gc3RhcnRUaW1lO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbkNvbm5lY3Rpb25SZWFkeShtb2RlKSB7XHJcbiAgICBjb250cm9sTW9kZSA9IG1vZGU7XHJcblxyXG5cdHN0YWdlTWFuYWdlci5pbml0KCk7XHJcblxyXG4gICAgaWYgKGNvbnRyb2xNb2RlID09PSAnZGVza3RvcE9ubHknKSB7XHJcbiAgICAgICAgZGVza3RvcENvbnRyb2xzTWFuYWdlci5pbml0KCk7XHJcbiAgICAgICAgdG91Y2hDb250cm9sc01hbmFnZXIuaW5pdCgpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBvbkdhbWVSZWFkeShuZXdHYW1lUm9vbUlELCBuZXdHYW1lSXNIb3N0KSB7XHJcbiAgICBnYW1lUm9vbUlEID0gbmV3R2FtZVJvb21JRDtcclxuICAgIGlzSG9zdCA9IG5ld0dhbWVJc0hvc3Q7XHJcbiAgICBzdGF0ZSA9ICdyZWFkeSc7XHJcblxyXG4gICAgcmFja2V0c01hbmFnZXIuc2V0UGxheWVyU2lkZShpc0hvc3QpO1xyXG4gICAgcmFja2V0c01hbmFnZXIucmVzZXRSYWNrZXRzUG9zaXRpb25zKCk7XHJcblxyXG4gICAgaWYgKGlzSG9zdCkge1xyXG4gICAgICAgIGJhbGxzTWFuYWdlci5jcmVhdGVCYWxscyg2NCwgbnVsbCwgNjUwLCAyMDAwLCA0KTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gb25PcHBvbmVudERpc2Nvbm5lY3QoKSB7XHJcbiAgICBzdGF0ZSA9ICd3YWl0aW5nJztcclxuICAgIGJhbGxzTWFuYWdlci5yZW1vdmVBbGxCYWxscygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRTdGF0ZSgpIHtcclxuICAgIHJldHVybiBzdGF0ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0SXNIb3N0KCkge1xyXG4gICAgcmV0dXJuIGlzSG9zdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TW9kZSgpIHtcclxuICAgIHJldHVybiBjb250cm9sTW9kZTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSAge1xyXG5cdGluaXQ6IGluaXQsXHJcbiAgICBnZXRTdGFydFRpbWU6IGdldFN0YXJ0VGltZSxcclxuICAgIG9uQ29ubmVjdGlvblJlYWR5OiBvbkNvbm5lY3Rpb25SZWFkeSxcclxuICAgIG9uR2FtZVJlYWR5OiBvbkdhbWVSZWFkeSxcclxuICAgIG9uT3Bwb25lbnREaXNjb25uZWN0OiBvbk9wcG9uZW50RGlzY29ubmVjdCxcclxuICAgIGdldFN0YXRlOiBnZXRTdGF0ZSxcclxuICAgIGdldElzSG9zdDogZ2V0SXNIb3N0LFxyXG4gICAgZ2V0TW9kZTogZ2V0TW9kZVxyXG59O1xyXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiaHRaa3g0XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvYXBwTWFuYWdlci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBCYWxsID0gcmVxdWlyZSgnLi9jbGFzcy9CYWxsJyk7XHJcblxyXG5cclxudmFyIGJhbGxzID0gW107XHJcblxyXG5mdW5jdGlvbiBpbml0KHNjZW5lKSB7XHJcblx0XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUJhbGwoYmFsbERhdGEpIHtcclxuICAgIGJhbGxEYXRhLklEID0gYmFsbERhdGEuSUQgfHwgZ2V0SUQoKTtcclxuICAgIGlmICghYmFsbHNbYmFsbERhdGEuSURdKSB7XHJcbiAgICBcdHZhciBuZXdCYWxsID0gbmV3IEJhbGwoYmFsbERhdGEuSUQsIGJhbGxEYXRhLnBvcywgYmFsbERhdGEuY29sb3IsIGJhbGxEYXRhLnJhZGl1cyk7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2NyZWF0ZWQgYmFsbCAjJyArIG5ld0JhbGwuSUQsIG5ld0JhbGwsIGJhbGxzW2JhbGxEYXRhLklEXSlcclxuICAgICAgICBwaHlzaWNzRW5naW5lLnNldFZlbChuZXdCYWxsLCBiYWxsRGF0YS52ZWwpO1xyXG4gICAgICAgIHN5bmNNYW5hZ2VyLm9uQ3JlYXRlQmFsbChuZXdCYWxsKTtcclxuICAgICAgICBzdGFnZU1hbmFnZXIuZ2V0U2NlbmUoKS5hZGRCYWxsKG5ld0JhbGwpO1xyXG4gICAgICAgIGJhbGxzW2JhbGxEYXRhLklEXSA9IG5ld0JhbGw7XHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgXHRcdG5ld0JhbGwuZW5hYmxlUGh5c2ljcygpO1xyXG5cdFx0fSwgNTApO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVCYWxscyhudW1iZXIsIHBvcywgdmVsLCBpbnRlcnZhbCwgdHVybnMsIGFuZ2xlLCByZW1haW5pbmcpIHtcclxuXHRwb3MgICA9IHBvcyAgIHx8IHN0YWdlTWFuYWdlci5nZXRTY2VuZSgpLmdldENlbnRlcigpO1xyXG4gICAgdmVsICAgPSB2ZWwgICB8fCAxMDAwO1xyXG4gICAgdHVybnMgPSB0dXJucyB8fCAxO1xyXG4gICAgYW5nbGUgPSBhbmdsZSA9PT0gdW5kZWZpbmVkID8gTWF0aC5QSS9udW1iZXIgOiBhbmdsZTtcclxuXHRyZW1haW5pbmcgPSByZW1haW5pbmcgPT09IHVuZGVmaW5lZCA/IG51bWJlciA6IHJlbWFpbmluZztcclxuICAgIGNyZWF0ZUJhbGwoe1xyXG4gICAgICAgIHBvczogcG9zLCBcclxuICAgICAgICB2ZWw6IG5ldyBWZWN0b3IyKHZlbCAqIE1hdGguY29zKGFuZ2xlICsgKE1hdGgucmFuZG9tKCkgLSAwLjUpICogTWF0aC5QSSAqIDAuMDgpICwgdmVsICogTWF0aC5zaW4oYW5nbGUgKyAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiBNYXRoLlBJICogMC4wOCkgKVxyXG4gICAgfSk7XHJcblx0aWYgKHJlbWFpbmluZyA+IDEgJiYgYXBwTWFuYWdlci5nZXRTdGF0ZSgpID09PSAncmVhZHknKSB7XHJcbiAgICBcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICBcdFx0Y3JlYXRlQmFsbHMobnVtYmVyLCBwb3MsIHZlbCwgaW50ZXJ2YWwsIHR1cm5zLCBhbmdsZSArIDIgKiB0dXJucyAqIE1hdGguUEkgLyBudW1iZXIsIHJlbWFpbmluZyAtIDEpO1xyXG4gICAgXHR9LCBpbnRlcnZhbCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZUJhbGwoYmFsbERhdGEpIHtcclxuICAgIGlmIChiYWxsRGF0YSAmJiBiYWxsRGF0YS5JRCAmJiBiYWxsc1tiYWxsRGF0YS5JRF0pIHtcclxuICAgICAgICBpZiAoYmFsbERhdGEucG9zKSB7XHJcbiAgICAgICAgICAgIGJhbGxzW2JhbGxEYXRhLklEXS54ID0gYmFsbERhdGEucG9zLng7XHJcbiAgICAgICAgICAgIGJhbGxzW2JhbGxEYXRhLklEXS55ID0gYmFsbERhdGEucG9zLnk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChiYWxsRGF0YS52ZWwpIHtcclxuICAgICAgICAgICAgYmFsbHNbYmFsbERhdGEuSURdLnZlbC5jb3B5KGJhbGxEYXRhLnZlbCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ2Vycm9yIDogYmFsbCAjJywgYmFsbERhdGEuSUQsIGJhbGxzW2JhbGxEYXRhLklEXSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbW92ZUFsbEJhbGxzKCkge1xyXG4gICAgYmFsbHMuZm9yRWFjaChyZW1vdmVCYWxsKTtcclxuICAgIHN0YWdlTWFuYWdlci5nZXRTY2VuZSgpLmNsZWFyQmFsbHMoKTtcclxuICAgIGJhbGxzID0gW107XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbW92ZUJhbGwoYmFsbCkge1xyXG4gICAgaWYgKGJhbGwpIHtcclxuICAgICAgICBzdGFnZU1hbmFnZXIuZ2V0U2NlbmUoKS5yZW1vdmVCYWxsKGJhbGwpO1xyXG4gICAgICAgIGRlbGV0ZSBiYWxsc1tiYWxsLklEXTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gb25CYWxsT3V0KGJhbGwpIHtcclxuICAgIGlmIChhcHBNYW5hZ2VyLmdldElzSG9zdCgpKSB7XHJcbiAgICAgICAgc3luY01hbmFnZXIub25CYWxsT3V0KGJhbGwpO1xyXG4gICAgICAgIHNldEJhbGxPdXQoYmFsbCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQmFsbE91dERlc3Ryb3koYmFsbCkge1xyXG4gICAgaWYgKGFwcE1hbmFnZXIuZ2V0SXNIb3N0KCkpIHtcclxuICAgICAgICBzeW5jTWFuYWdlci5vbkJhbGxEZXN0cm95KGJhbGwpO1xyXG4gICAgICAgIGRlc3Ryb3lCYWxsKGJhbGwpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRCYWxsT3V0KGJhbGwpIHtcclxuICAgIGJhbGwub3V0ID0gdHJ1ZTtcclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZGVzdHJveUJhbGwoYmFsbCk7XHJcbiAgICB9LCA3NTApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkZXN0cm95QmFsbChiYWxsKSB7XHJcbiAgICBwYXJ0aWNsZXNNYW5hZ2VyLmNyZWF0ZUJhbGxFeHBsb2RlUGFydGljbGVzKGJhbGwpO1xyXG4gICAgcmVtb3ZlQmFsbChiYWxsKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0SUQoKSB7XHJcbiAgICB2YXIgSUQgPSBNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiAxMDAwMCk7XHJcbiAgICByZXR1cm4gYmFsbHNbSURdID8gZ2V0SUQoKSA6IElEO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRCYWxscygpIHtcclxuXHRyZXR1cm4gYmFsbHM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEJhbGwoSUQpIHtcclxuICAgIHJldHVybiBiYWxsc1tJRF0gfHwgbnVsbDtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSAge1xyXG5cdGluaXQ6IGluaXQsXHJcblx0Y3JlYXRlQmFsbDogY3JlYXRlQmFsbCxcclxuXHRjcmVhdGVCYWxsczogY3JlYXRlQmFsbHMsXHJcbiAgICB1cGRhdGVCYWxsOiB1cGRhdGVCYWxsLFxyXG4gICAgcmVtb3ZlQWxsQmFsbHM6IHJlbW92ZUFsbEJhbGxzLFxyXG4gICAgcmVtb3ZlQmFsbDogcmVtb3ZlQmFsbCxcclxuICAgIGdldElEOiBnZXRJRCxcclxuXHRnZXRCYWxsczogZ2V0QmFsbHMsXHJcbiAgICBnZXRCYWxsOiBnZXRCYWxsLFxyXG4gICAgb25CYWxsT3V0OiBvbkJhbGxPdXQsXHJcbiAgICBvbkJhbGxPdXREZXN0cm95OiBvbkJhbGxPdXREZXN0cm95LFxyXG4gICAgc2V0QmFsbE91dDogc2V0QmFsbE91dCxcclxuICAgIGRlc3Ryb3lCYWxsOiBkZXN0cm95QmFsbFxyXG59O1xyXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiaHRaa3g0XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvYmFsbHNNYW5hZ2VyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuQmFsbCA9IGZ1bmN0aW9uKElELCBwb3MsIGNvbG9yLCBzaXplKSB7XHJcbiAgICBQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCggdGhpcyApO1xyXG4gICAgdGhpcy5JRCA9IElEO1xyXG4gICAgdGhpcy5zaXplID0gc2l6ZSB8fCAyODtcclxuICAgIHRoaXMuY29sb3IgID0gY29sb3IgIHx8IHBhcnNlSW50KFBsZWFzZS5tYWtlX2NvbG9yKCkuc2xpY2UoMSksIDE2KTtcclxuICAgIHRoaXMuY29sb3JIZXggPSAnIycgKyB0aGlzLmNvbG9yLnRvU3RyaW5nKDE2KTtcclxuICAgIHRoaXMudmVsID0gbmV3IFZlY3RvcjIoMCwgMCk7XHJcbiAgICB0aGlzLm91dCA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMucGh5c2ljcyA9IGZhbHNlO1xyXG5cclxuXHR2YXIgZ3JhcGhpY3MgPSBuZXcgUElYSS5HcmFwaGljcygpO1xyXG5cdGdyYXBoaWNzLmJlZ2luRmlsbCh0aGlzLmNvbG9yKTtcclxuXHRncmFwaGljcy5kcmF3UmVjdCgwLCAwLCB0aGlzLnNpemUsIHRoaXMuc2l6ZSk7XHJcbiAgICB0aGlzLmFkZENoaWxkKGdyYXBoaWNzKTtcclxuXHJcbiAgICB0aGlzLnggPSBwb3MgPyBwb3MueCA6IDA7XHJcbiAgICB0aGlzLnkgPSBwb3MgPyBwb3MueSA6IDA7XHJcbiAgICBcclxufTtcclxuXHJcbkJhbGwucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlKTtcclxuQmFsbC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBCYWxsO1xyXG5cclxuQmFsbC5wcm90b3R5cGUuZW5hYmxlUGh5c2ljcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5waHlzaWNzID0gdHJ1ZTtcclxufTtcclxuXHJcbkJhbGwucHJvdG90eXBlLmRpc2FibGVQaHlzaWNzID0gZnVuY3Rpb24oKSB7XHJcblx0dGhpcy5waHlzaWNzID0gZmFsc2U7XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCYWxsO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9jbGFzc1xcXFxCYWxsLmpzXCIsXCIvY2xhc3NcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5IdWQgPSBmdW5jdGlvbigpIHtcclxuICAgIFBJWEkuRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKCB0aGlzICk7XHJcbiAgICB0aGlzLmluZm9zID0gbmV3IFBJWEkuVGV4dCgnJywge2ZvbnQ6ICdib2xkIDQwcHggQXJpYWwnfSk7XHJcbiAgICB0aGlzLmluZm9zLnggPSAxMDtcclxuICAgIHRoaXMuaW5mb3MueSA9IDEwO1xyXG4gICAgdGhpcy5hZGRDaGlsZCh0aGlzLmluZm9zKTtcclxuXHJcbiAgICB0aGlzLmRlYnVnMSA9IG5ldyBQSVhJLlRleHQoJycpO1xyXG4gICAgdGhpcy5kZWJ1ZzEueCA9IDEwMDtcclxuICAgIHRoaXMuZGVidWcxLnkgPSA0MDA7XHJcbiAgICB0aGlzLmFkZENoaWxkKHRoaXMuZGVidWcxKTtcclxuXHJcbiAgICB0aGlzLmRlYnVnMiA9IG5ldyBQSVhJLlRleHQoJycpO1xyXG4gICAgdGhpcy5kZWJ1ZzIueCA9IDQwMDtcclxuICAgIHRoaXMuZGVidWcyLnkgPSA0MDA7XHJcbiAgICB0aGlzLmFkZENoaWxkKHRoaXMuZGVidWcyKTtcclxuXHJcbn07XHJcblxyXG5IdWQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlKTtcclxuSHVkLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEh1ZDtcclxuXHJcbkh1ZC5wcm90b3R5cGUuc2V0SW5mb3NUZXh0ID0gZnVuY3Rpb24odGV4dCkge1xyXG4gICAgdGhpcy5pbmZvcy5zZXRUZXh0KHRleHQpO1xyXG4gICAgdGhpcy5pbmZvcy5zZXRTdHlsZSh7XHJcbiAgICAgICAgZm9udDogJ2JvbGQgNDBweCBBcmlhbCcsXHJcbiAgICAgICAgZmlsbDogUGxlYXNlLm1ha2VfY29sb3IoKX0pO1xyXG59O1xyXG5cclxuSHVkLnByb3RvdHlwZS5zZXREZWJ1ZzFUZXh0ID0gZnVuY3Rpb24odGV4dCkge1xyXG4gICAgdGhpcy5kZWJ1ZzEuc2V0VGV4dCh0ZXh0KTtcclxuICAgIHRoaXMuZGVidWcxLnNldFN0eWxlKHtmaWxsOiBQbGVhc2UubWFrZV9jb2xvcigpfSk7XHJcbn07XHJcblxyXG5IdWQucHJvdG90eXBlLnNldERlYnVnMlRleHQgPSBmdW5jdGlvbih0ZXh0KSB7XHJcbiAgICB0aGlzLmRlYnVnMi5zZXRUZXh0KHRleHQpO1xyXG4gICAgdGhpcy5kZWJ1ZzIuc2V0U3R5bGUoe2ZpbGw6IFBsZWFzZS5tYWtlX2NvbG9yKCl9KTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEh1ZDtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiaHRaa3g0XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvY2xhc3NcXFxcSHVkLmpzXCIsXCIvY2xhc3NcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5SYWNrZXQgPSBmdW5jdGlvbihwb3MsIGNvbG9yKSB7XHJcbiAgICBQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCggdGhpcyApO1xyXG4gICAgcG9zID0gcG9zIHx8IG5ldyBWZWN0b3IyKCk7XHJcbiAgICB0aGlzLmNvbG9yID0gY29sb3IgfHwgMHhGRkZGRkY7XHJcbiAgICB0aGlzLnNpemUgPSAyNDA7XHJcblxyXG4gICAgdGhpcy5ncmFwaGljcyA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XHJcbiAgICB0aGlzLmdyYXBoaWNzLmJlZ2luRmlsbCh0aGlzLmNvbG9yKTtcclxuICAgIHRoaXMuZ3JhcGhpY3MuZHJhd1JlY3QoMCwgMCwgNDAsIHRoaXMuc2l6ZSk7XHJcbiAgICB0aGlzLmFkZENoaWxkKHRoaXMuZ3JhcGhpY3MpO1xyXG5cclxuICAgIHRoaXMudmVsID0gbmV3IFZlY3RvcjIoKTtcclxuXHJcbiAgICB0aGlzLnVwZGF0ZVBpdm90KCk7XHJcbiAgICB0aGlzLnggPSBwb3MueDtcclxuICAgIHRoaXMueSA9IHBvcy55O1xyXG5cclxuICAgIHRoaXMubW92aW5nVG9ZID0gMDtcclxufTtcclxuXHJcblJhY2tldC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFBJWEkuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUpO1xyXG5SYWNrZXQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gUmFja2V0O1xyXG5cclxuUmFja2V0LnByb3RvdHlwZS5zZXRNb3ZpbmdUb1kgPSBmdW5jdGlvbih5KSB7XHJcblx0dGhpcy5tb3ZpbmdUb1kgPSB5IC0gdGhpcy5oZWlnaHQgKiAwLjUgPCAwID8gdGhpcy5oZWlnaHQgKiAwLjUgOlxyXG4gICAgICAgICAgICAgICAgICAgICB5ICsgdGhpcy5oZWlnaHQgKiAwLjUgPiBnYW1lQ29uZmlnLmJhc2VTY2VuZUhlaWdodCA/IGdhbWVDb25maWcuYmFzZVNjZW5lSGVpZ2h0IC0gdGhpcy5oZWlnaHQgKiAwLjUgOlxyXG4gICAgICAgICAgICAgICAgICAgICB5O1xyXG5cclxufTtcclxuXHJcblJhY2tldC5wcm90b3R5cGUudXBkYXRlUGl2b3QgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMucGl2b3QueCA9IHRoaXMud2lkdGggKiAwLjU7XHJcbiAgICB0aGlzLnBpdm90LnkgPSB0aGlzLmhlaWdodCAqIDAuNTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFJhY2tldDtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiaHRaa3g0XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvY2xhc3NcXFxcUmFja2V0LmpzXCIsXCIvY2xhc3NcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5TY2VuZSA9IGZ1bmN0aW9uKGJhc2VXaWR0aCwgYmFzZUhlaWdodCkge1xyXG4gICAgUElYSS5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLmNhbGwoIHRoaXMgKTtcclxuICAgIHRoaXMuYmFzZVdpZHRoID0gYmFzZVdpZHRoO1xyXG4gICAgdGhpcy5iYXNlSGVpZ2h0ID0gYmFzZUhlaWdodDtcclxuICAgIHRoaXMud2lkdGggPSBiYXNlV2lkdGg7XHJcbiAgICB0aGlzLmhlaWdodCA9IGJhc2VIZWlnaHQ7XHJcbiAgICB0aGlzLmluaXQoKTtcclxufTtcclxuXHJcblNjZW5lLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUElYSS5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSk7XHJcblNjZW5lLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFNjZW5lO1xyXG5cclxuU2NlbmUucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbigpIHtcclxuXHR0aGlzLmRyYXdCb3VuZHMoKTtcclxuXHJcblx0dGhpcy5wYXJ0aWNsZXNDb250YWluZXIgPSBuZXcgUElYSS5EaXNwbGF5T2JqZWN0Q29udGFpbmVyKCk7ICAgICAgICBcclxuXHR0aGlzLnJhY2tldHNDb250YWluZXIgICA9IG5ldyBQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIoKTsgICAgICAgIFxyXG5cdHRoaXMuYmFsbHNDb250YWluZXIgICAgID0gbmV3IFBJWEkuRGlzcGxheU9iamVjdENvbnRhaW5lcigpOyBcclxuXHJcbiAgICB0aGlzLmFkZENoaWxkKHRoaXMucGFydGljbGVzQ29udGFpbmVyKTtcclxuICAgIHRoaXMuYWRkQ2hpbGQodGhpcy5yYWNrZXRzQ29udGFpbmVyKTtcclxuICAgIHRoaXMuYWRkQ2hpbGQodGhpcy5iYWxsc0NvbnRhaW5lcik7XHJcbn07XHJcblxyXG5TY2VuZS5wcm90b3R5cGUuZHJhd0JvdW5kcyA9IGZ1bmN0aW9uKCkge1xyXG5cdHZhciBncmFwaGljcyA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XHJcbiBcdCBcclxuXHRncmFwaGljcy5iZWdpbkZpbGwoMHgyMjIyMjIpO1xyXG5cdC8vIGdyYXBoaWNzLmxpbmVTdHlsZSg1LCAweEZGRkZGRik7XHJcblx0Z3JhcGhpY3MuZHJhd1JlY3QoMCwgMCwgdGhpcy5iYXNlV2lkdGgsIHRoaXMuYmFzZUhlaWdodCk7XHJcblxyXG5cdHRoaXMuYWRkQ2hpbGQoZ3JhcGhpY3MpO1xyXG59O1xyXG5cclxuU2NlbmUucHJvdG90eXBlLmdldENlbnRlciA9IGZ1bmN0aW9uKCkge1xyXG5cdHJldHVybiBuZXcgVmVjdG9yMih0aGlzLmJhc2VXaWR0aCAvIDIsIHRoaXMuYmFzZUhlaWdodCAvIDIpO1xyXG59O1xyXG5cclxuLy8gU2NlbmUucHJvdG90eXBlLmNsZWFyT2JqZWN0c09mVHlwZSA9IGZ1bmN0aW9uKHR5cGUpIHtcclxuLy8gXHR2YXIgb2JqZWN0cyA9IF8uZmlsdGVyKHRoaXMuY2hpbGRyZW4sIGZ1bmN0aW9uKG9iamVjdCkgeyBcclxuLy8gXHRcdHJldHVybiBvYmplY3QgaW5zdGFuY2VvZiB0eXBlO1xyXG4vLyBcdH0pO1xyXG5cclxuLy8gXHRvYmplY3RzLmZvckVhY2goZnVuY3Rpb24ob2JqZWN0KSB7XHJcbi8vIFx0XHR0aGlzLnJlbW92ZUNoaWxkKG9iamVjdCk7XHJcbi8vIFx0fS5iaW5kKHRoaXMpKTtcclxuLy8gfTtcclxuXHJcblNjZW5lLnByb3RvdHlwZS5jbGVhckJhbGxzID0gZnVuY3Rpb24oKSB7XHJcblx0dGhpcy5iYWxsc0NvbnRhaW5lci5yZW1vdmVDaGlsZHJlbigpO1xyXG59O1xyXG5cclxuU2NlbmUucHJvdG90eXBlLmFkZEJhbGwgPSBmdW5jdGlvbihiYWxsKSB7XHJcblx0dGhpcy5iYWxsc0NvbnRhaW5lci5hZGRDaGlsZChiYWxsKTtcclxufTtcclxuXHJcblNjZW5lLnByb3RvdHlwZS5yZW1vdmVCYWxsID0gZnVuY3Rpb24oYmFsbCkge1xyXG5cdHRoaXMuYmFsbHNDb250YWluZXIucmVtb3ZlQ2hpbGQoYmFsbCk7XHJcbn07XHJcblxyXG5TY2VuZS5wcm90b3R5cGUuYWRkUmFja2V0ID0gZnVuY3Rpb24ocmFja2V0KSB7XHJcblx0dGhpcy5yYWNrZXRzQ29udGFpbmVyLmFkZENoaWxkKHJhY2tldCk7XHJcbn07XHJcblxyXG5TY2VuZS5wcm90b3R5cGUuZ2V0UGFydGljbGVzQ29udGFpbmVyID0gZnVuY3Rpb24oKSB7XHJcblx0cmV0dXJuIHRoaXMucGFydGljbGVzQ29udGFpbmVyO1xyXG59O1xyXG5cclxuU2NlbmUucHJvdG90eXBlLmdldFJhY2tldHNDb250YWluZXIgPSBmdW5jdGlvbigpIHtcclxuXHRyZXR1cm4gdGhpcy5yYWNrZXRzQ29udGFpbmVyO1xyXG59O1xyXG5cclxuU2NlbmUucHJvdG90eXBlLmdldEJhbGxzQ29udGFpbmVyID0gZnVuY3Rpb24oKSB7XHJcblx0cmV0dXJuIHRoaXMuYmFsbHNDb250YWluZXI7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNjZW5lO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9jbGFzc1xcXFxTY2VuZS5qc1wiLFwiL2NsYXNzXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyoqXHJcbiAqIEBhdXRob3IgbXIuZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tL1xyXG4gKiBAYXV0aG9yIHBoaWxvZ2IgLyBodHRwOi8vYmxvZy50aGVqaXQub3JnL1xyXG4gKiBAYXV0aG9yIGVncmFldGhlciAvIGh0dHA6Ly9lZ3JhZXRoZXIuY29tL1xyXG4gKiBAYXV0aG9yIHp6ODUgLyBodHRwOi8vd3d3LmxhYjRnYW1lcy5uZXQveno4NS9ibG9nXHJcbiAqL1xyXG5cclxuVmVjdG9yMiA9IGZ1bmN0aW9uICggeCwgeSApIHtcclxuXHJcblx0dGhpcy54ID0geCB8fCAwO1xyXG5cdHRoaXMueSA9IHkgfHwgMDtcclxuXHJcbn07XHJcblxyXG5WZWN0b3IyLnByb3RvdHlwZSA9IHtcclxuXHJcblx0Y29uc3RydWN0b3I6IFZlY3RvcjIsXHJcblxyXG5cdHNldDogZnVuY3Rpb24gKCB4LCB5ICkge1xyXG5cclxuXHRcdHRoaXMueCA9IHg7XHJcblx0XHR0aGlzLnkgPSB5O1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHRjb3B5OiBmdW5jdGlvbiAoIHYgKSB7XHJcblxyXG5cdFx0dGhpcy54ID0gdi54O1xyXG5cdFx0dGhpcy55ID0gdi55O1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHRjbG9uZTogZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdHJldHVybiBuZXcgVmVjdG9yMiggdGhpcy54LCB0aGlzLnkgKTtcclxuXHJcblx0fSxcclxuXHJcblxyXG5cdGFkZDogZnVuY3Rpb24gKCB2MSwgdjIgKSB7XHJcblxyXG5cdFx0dGhpcy54ID0gdjEueCArIHYyLng7XHJcblx0XHR0aGlzLnkgPSB2MS55ICsgdjIueTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHJcblx0fSxcclxuXHJcblx0YWRkU2VsZjogZnVuY3Rpb24gKCB2ICkge1xyXG5cclxuXHRcdHRoaXMueCArPSB2Lng7XHJcblx0XHR0aGlzLnkgKz0gdi55O1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHRzdWI6IGZ1bmN0aW9uICggdjEsIHYyICkge1xyXG5cclxuXHRcdHRoaXMueCA9IHYxLnggLSB2Mi54O1xyXG5cdFx0dGhpcy55ID0gdjEueSAtIHYyLnk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblxyXG5cdH0sXHJcblxyXG5cdHN1YlNlbGY6IGZ1bmN0aW9uICggdiApIHtcclxuXHJcblx0XHR0aGlzLnggLT0gdi54O1xyXG5cdFx0dGhpcy55IC09IHYueTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHJcblx0fSxcclxuXHJcblx0bXVsdGlwbHlTY2FsYXI6IGZ1bmN0aW9uICggcyApIHtcclxuXHJcblx0XHR0aGlzLnggKj0gcztcclxuXHRcdHRoaXMueSAqPSBzO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHRkaXZpZGVTY2FsYXI6IGZ1bmN0aW9uICggcyApIHtcclxuXHJcblx0XHRpZiAoIHMgKSB7XHJcblxyXG5cdFx0XHR0aGlzLnggLz0gcztcclxuXHRcdFx0dGhpcy55IC89IHM7XHJcblxyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdHRoaXMuc2V0KCAwLCAwICk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHJcblx0bmVnYXRlOiBmdW5jdGlvbigpIHtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy5tdWx0aXBseVNjYWxhciggLTEgKTtcclxuXHJcblx0fSxcclxuXHJcblx0ZG90OiBmdW5jdGlvbiAoIHYgKSB7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMueCAqIHYueCArIHRoaXMueSAqIHYueTtcclxuXHJcblx0fSxcclxuXHJcblx0bGVuZ3RoU3E6IGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55O1xyXG5cclxuXHR9LFxyXG5cclxuXHRsZW5ndGg6IGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRyZXR1cm4gTWF0aC5zcXJ0KCB0aGlzLmxlbmd0aFNxKCkgKTtcclxuXHJcblx0fSxcclxuXHJcblx0bm9ybWFsaXplOiBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuZGl2aWRlU2NhbGFyKCB0aGlzLmxlbmd0aCgpICk7XHJcblxyXG5cdH0sXHJcblxyXG5cdGRpc3RhbmNlVG86IGZ1bmN0aW9uICggdiApIHtcclxuXHJcblx0XHRyZXR1cm4gTWF0aC5zcXJ0KCB0aGlzLmRpc3RhbmNlVG9TcXVhcmVkKCB2ICkgKTtcclxuXHJcblx0fSxcclxuXHJcblx0ZGlzdGFuY2VUb1NxdWFyZWQ6IGZ1bmN0aW9uICggdiApIHtcclxuXHJcblx0XHR2YXIgZHggPSB0aGlzLnggLSB2LngsIGR5ID0gdGhpcy55IC0gdi55O1xyXG5cdFx0cmV0dXJuIGR4ICogZHggKyBkeSAqIGR5O1xyXG5cclxuXHR9LFxyXG5cclxuXHJcblx0c2V0TGVuZ3RoOiBmdW5jdGlvbiAoIGwgKSB7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMubm9ybWFsaXplKCkubXVsdGlwbHlTY2FsYXIoIGwgKTtcclxuXHJcblx0fSxcclxuXHJcblx0ZXF1YWxzOiBmdW5jdGlvbiggdiApIHtcclxuXHJcblx0XHRyZXR1cm4gKCAoIHYueCA9PT0gdGhpcy54ICkgJiYgKCB2LnkgPT09IHRoaXMueSApICk7XHJcblxyXG5cdH1cclxuXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFZlY3RvcjI7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcImh0Wmt4NFwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2NsYXNzXFxcXFZlY3RvcjIuanNcIixcIi9jbGFzc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBzdGFydFRpbWUsXHJcbiAgICBnZXN0dXJlcyxcclxuICAgIG1vdXNlWSA9IDAsXHJcbiAgICBsYXN0TW91c2VZID0gMCxcclxuICAgIG1vdXNlU3RvcFRpbWUgPSAtMSxcclxuICAgIGxhc3RTZW50WSA9IDA7XHJcblxyXG5cclxuZnVuY3Rpb24gaW5pdCgpIHtcclxuXHJcbiAgICAkKCBkb2N1bWVudCApLm9uKCAnbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZSggZGVsdGEgKSB7XHJcblxyXG4gICAgLy8gYXV0b21hdGljYWxseSBzZW5kIHN5bmMgb2YgZXhhY3QgcG9zaXRpb24gYWZ0ZXIgbW91c2Ugc3RvcCAwLjFzIFxyXG4gICAgaWYgKCBtb3VzZVN0b3BUaW1lID4gMC4xICkge1xyXG5cclxuICAgICAgICBzZW5kU3luY1Bvc2l0aW9uKCBsYXN0TW91c2VZLCB0cnVlICk7XHJcbiAgICAgICAgbW91c2VTdG9wVGltZSA9IC0xO1xyXG5cclxuICAgIH0gZWxzZSBpZiAoIGxhc3RNb3VzZVkgPT09IG1vdXNlWSAmJiBtb3VzZVN0b3BUaW1lID49IDAgKSB7XHJcblxyXG4gICAgICAgIG1vdXNlU3RvcFRpbWUgKz0gZGVsdGE7XHJcblxyXG4gICAgfSBlbHNlIGlmICggbGFzdE1vdXNlWSAhPT0gbW91c2VZICkge1xyXG5cclxuICAgICAgICAvLyBzeW5jIG1vdXNlIHBvc2l0aW9uIGlmIG1vdmVkIGJ5IG1vcmUgdGhhbiAyNHB4IChsb2NhbClcclxuICAgICAgICBpZiAoIE1hdGguYWJzKCBsYXN0U2VudFkgLSBzdGFnZU1hbmFnZXIuZ2xvYmFsVG9TY2VuZUxvY2FsWSggbW91c2VZICkgKSA+IDI0ICkge1xyXG5cclxuICAgICAgICAgICAgc2VuZFN5bmNQb3NpdGlvbiggbW91c2VZLCBmYWxzZSApO1xyXG5cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgbGFzdE1vdXNlWSA9IG1vdXNlWTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlbmRTeW5jUG9zaXRpb24oIHksIGluc3RhbnQgKSB7XHJcblxyXG4gICAgbGFzdFNlbnRZID0gcmFja2V0c01hbmFnZXIuZ2V0UGxheWVyUmFja2V0TW92aW5nVG9ZKCk7XHJcbiAgICBzeW5jTWFuYWdlci5vblJhY2tldFNldE1vdmluZ1RvWSggbGFzdFNlbnRZLCBpbnN0YW50ICk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBvbk1vdXNlTW92ZSggZXZlbnQgKSB7XHJcblxyXG4gICAgbW91c2VZID0gZXZlbnQucGFnZVkgfHwgZXZlbnQub3JpZ2luYWxFdmVudC50b3VjaGVzICYmIGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlc1sgMCBdLnBhZ2VZO1xyXG4gICAgXHJcbiAgICBpZiAobW91c2VZICE9PSB1bmRlZmluZWQpIHtcclxuXHJcbiAgICAgICAgcmFja2V0c01hbmFnZXIubW92ZVBsYXllclJhY2tldFRvKCBzdGFnZU1hbmFnZXIuZ2xvYmFsVG9TY2VuZUxvY2FsWSggbW91c2VZICksIGZhbHNlICk7XHJcbiAgICAgICAgbW91c2VTdG9wVGltZSA9IDA7XHJcbiAgICAgICAgXHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgaW5pdDogaW5pdCxcclxuICAgIHVwZGF0ZTogdXBkYXRlXHJcbn07XHJcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9kZXNrdG9wQ29udHJvbHNNYW5hZ2VyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZ2xvYmFsLmdhbWVDb25maWcgPSB7XHJcbiAgICB3aWR0aDogd2luZG93LmlubmVyV2lkdGgsXHJcbiAgICBoZWlnaHQ6IHdpbmRvdy5pbm5lckhlaWdodCxcclxuICAgIGJhc2VTY2VuZVdpZHRoOiAxNDQwLFxyXG4gICAgYmFzZVNjZW5lSGVpZ2h0OiA5MDAsXHJcbiAgICBjaGVja0RlbHRhSW50ZXJ2YWxUaW1lOiA1MDBcclxufTtcclxuXHJcbmdsb2JhbC5hcHBNYW5hZ2VyICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9hcHBNYW5hZ2VyJyk7XHJcbmdsb2JhbC5iYWxsc01hbmFnZXIgICAgICAgICAgID0gcmVxdWlyZSgnLi9iYWxsc01hbmFnZXInKTtcclxuZ2xvYmFsLmRlc2t0b3BDb250cm9sc01hbmFnZXIgPSByZXF1aXJlKCcuL2Rlc2t0b3BDb250cm9sc01hbmFnZXInKTtcclxuZ2xvYmFsLnRvdWNoQ29udHJvbHNNYW5hZ2VyICAgPSByZXF1aXJlKCcuL3RvdWNoQ29udHJvbHNNYW5hZ2VyJyk7XHJcbmdsb2JhbC5odWRNYW5hZ2VyICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9odWRNYW5hZ2VyJyk7XHJcbmdsb2JhbC5wYXJ0aWNsZXNNYW5hZ2VyICAgICAgID0gcmVxdWlyZSgnLi9wYXJ0aWNsZXNNYW5hZ2VyJyk7XHJcbmdsb2JhbC5waHlzaWNzRW5naW5lICAgICAgICAgID0gcmVxdWlyZSgnLi9waHlzaWNzRW5naW5lJyk7XHJcbmdsb2JhbC5yYWNrZXRzTWFuYWdlciAgICAgICAgID0gcmVxdWlyZSgnLi9yYWNrZXRzTWFuYWdlcicpO1xyXG5nbG9iYWwuc29ja2V0c01hbmFnZXIgICAgICAgICA9IHJlcXVpcmUoJy4vc29ja2V0c01hbmFnZXInKTtcclxuZ2xvYmFsLnN0YWdlTWFuYWdlciAgICAgICAgICAgPSByZXF1aXJlKCcuL3N0YWdlTWFuYWdlcicpO1xyXG5nbG9iYWwuc3luY01hbmFnZXIgICAgICAgICAgICA9IHJlcXVpcmUoJy4vc3luY01hbmFnZXInKTtcclxuXHJcblxyXG5pZiAoIHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gXCJmaWxlOlwiICkgeyAvLyBjb3Jkb3ZhXHJcblxyXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJkZXZpY2VyZWFkeVwiLCBvbkRldmljZVJlYWR5LCBmYWxzZSk7XHJcblxyXG59IGVsc2Uge1xyXG5cclxuXHRhcHBNYW5hZ2VyLmluaXQoKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uRGV2aWNlUmVhZHkoKSB7XHJcblx0YXBwTWFuYWdlci5pbml0KCk7XHJcbn1cclxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcImh0Wmt4NFwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2Zha2VfZWY3NmRhYmEuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgSHVkID0gcmVxdWlyZSgnLi9jbGFzcy9IdWQnKTtcclxuXHJcbnZhciBodWQ7XHJcblxyXG5mdW5jdGlvbiBpbml0KCkge1xyXG5cdGh1ZCA9IG5ldyBIdWQoKTtcclxuICAgIHN0YWdlTWFuYWdlci5nZXRTdGFnZSgpLmFkZENoaWxkKGh1ZCk7XHJcblxyXG4gICAgc2V0RGVidWcxVGV4dCgnWU9VOicpO1xyXG4gICAgc2V0RGVidWcyVGV4dCgnSElNOicpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpbml0U3RhZ2UoKSB7XHJcblx0Y29uc29sZS5sb2coJ2luaXRTdGFnZScpO1xyXG5cdHN0YWdlTWFuYWdlci5pbml0KCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldEluZm9zVGV4dCh0ZXh0KSB7XHJcbiAgICBodWQuc2V0SW5mb3NUZXh0KHRleHQpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXREZWJ1ZzFUZXh0KHRleHQpIHtcclxuICAgIGh1ZC5zZXREZWJ1ZzFUZXh0KHRleHQpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXREZWJ1ZzJUZXh0KHRleHQpIHtcclxuICAgIGh1ZC5zZXREZWJ1ZzJUZXh0KHRleHQpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRpbml0OiBpbml0LFxyXG4gICAgc2V0SW5mb3NUZXh0OiBzZXRJbmZvc1RleHQsXHJcbiAgICBzZXREZWJ1ZzFUZXh0OiBzZXREZWJ1ZzFUZXh0LFxyXG4gICAgc2V0RGVidWcyVGV4dDogc2V0RGVidWcyVGV4dFxyXG59O1xyXG5cclxuXHJcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9odWRNYW5hZ2VyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIF8gPSByZXF1aXJlKCdsb2Rhc2gnKTtcclxuXHJcbnZhciBwYXJ0aWNsZXNDb250YWluZXIsXHJcbiAgICBlbWl0dGVycyA9IFtdLFxyXG4gICAgcG9vbFNpemUgPSAxOCxcclxuICAgIHBvb2wgPSBbXTtcclxuXHJcblxyXG5mdW5jdGlvbiBpbml0KCkge1xyXG4gICAgcGFydGljbGVzQ29udGFpbmVyID0gc3RhZ2VNYW5hZ2VyLmdldFNjZW5lKCkuZ2V0UGFydGljbGVzQ29udGFpbmVyKCk7XHJcbiAgICBpbml0UG9vbCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGUoZGVsdGEpIHtcclxuICAgIHBvb2wuZm9yRWFjaChmdW5jdGlvbihlbWl0dGVyLCBpbmRleCkge1xyXG4gICAgICAgIGlmIChlbWl0dGVyLmVtaXQgfHwgZW1pdHRlci5fYWN0aXZlUGFydGljbGVzLmxlbmd0aClcclxuICAgICAgICBlbWl0dGVyLnVwZGF0ZShkZWx0YSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdFBvb2woKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvb2xTaXplOyBpKyspIHtcclxuICAgICAgICBwb29sW2ldID0gbmV3IGNsb3Vka2lkLkVtaXR0ZXIocGFydGljbGVzQ29udGFpbmVyKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdFVudXNlZEVtaXR0ZXIoY29uZmlnKSB7XHJcbiAgICB2YXIgZW1pdHRlciA9IGZpbmRVbnVzZWRFbWl0dGVyKCk7XHJcbiAgICBpZiAoZW1pdHRlcikge1xyXG4gICAgICAgIGVtaXR0ZXIuaW5pdChbUElYSS5UZXh0dXJlLmZyb21JbWFnZSgndGV4dHVyZXMvcGl4ZWwyNC5wbmcnKV0sIGNvbmZpZyk7XHJcbiAgICAgICAgZW1pdHRlci5lbWl0ID0gdHJ1ZTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gZmluZFVudXNlZEVtaXR0ZXIoKSB7XHJcbiAgICByZXR1cm4gXy5maW5kKHBvb2wsIGZ1bmN0aW9uKGVtaXR0ZXIpIHtcclxuICAgICAgICByZXR1cm4gIWVtaXR0ZXIuZW1pdCAmJiBlbWl0dGVyLl9hY3RpdmVQYXJ0aWNsZXMubGVuZ3RoID09PSAwO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUJhbGxDb2xsaWRlUGFydGljbGVzKGJhbGwsIGFuZ2xlKSB7XHJcbiAgICBpZiAoYmFsbCkgeyBcclxuICAgICAgICBpbml0VW51c2VkRW1pdHRlcih7XHJcbiAgICAgICAgICAgIFwiYWxwaGFcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJzdGFydFwiOiAwLjgsXHJcbiAgICAgICAgICAgICAgICBcImVuZFwiOiAwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwic2NhbGVcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJzdGFydFwiOiAxIC8gMjQgKiBiYWxsLnNpemUsXHJcbiAgICAgICAgICAgICAgICBcImVuZFwiOiAgIDEgLyA1NCAqIGJhbGwuc2l6ZSxcclxuICAgICAgICAgICAgICAgIFwibWluaW11bVNjYWxlTXVsdGlwbGllclwiOiAxXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiY29sb3JcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJzdGFydFwiOiBiYWxsLmNvbG9ySGV4LFxyXG4gICAgICAgICAgICAgICAgXCJlbmRcIjogXCIjMzMzMzMzXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJzcGVlZFwiOiB7XHJcbiAgICAgICAgICAgICAgICBcInN0YXJ0XCI6IDEwICogYmFsbC5zaXplLFxyXG4gICAgICAgICAgICAgICAgXCJlbmRcIjogMiAqIGJhbGwuc2l6ZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBcImFjY2VsZXJhdGlvblwiOiB7XHJcbiAgICAgICAgICAgICAgICBcInhcIjogMCxcclxuICAgICAgICAgICAgICAgIFwieVwiOiAwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwic3RhcnRSb3RhdGlvblwiOiB7XHJcbiAgICAgICAgICAgICAgICBcIm1pblwiOiBhbmdsZSAtIDYwLFxyXG4gICAgICAgICAgICAgICAgXCJtYXhcIjogYW5nbGUgKyA2MFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBcInJvdGF0aW9uU3BlZWRcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJtaW5cIjogMCxcclxuICAgICAgICAgICAgICAgIFwibWF4XCI6IDBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJsaWZldGltZVwiOiB7XHJcbiAgICAgICAgICAgICAgICBcIm1pblwiOiAwLjIsXHJcbiAgICAgICAgICAgICAgICBcIm1heFwiOiAwLjVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJibGVuZE1vZGVcIjogXCJub3JtYWxcIixcclxuICAgICAgICAgICAgXCJmcmVxdWVuY3lcIjogMC4wMixcclxuICAgICAgICAgICAgXCJlbWl0dGVyTGlmZXRpbWVcIjogMC4yLFxyXG4gICAgICAgICAgICBcIm1heFBhcnRpY2xlc1wiOiA2LFxyXG4gICAgICAgICAgICBcInBvc1wiOiB7XHJcbiAgICAgICAgICAgICAgICBcInhcIjogYmFsbC54ICsgYmFsbC5zaXplIC8gMixcclxuICAgICAgICAgICAgICAgIFwieVwiOiBiYWxsLnkgKyBiYWxsLnNpemUgLyAyXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiYWRkQXRCYWNrXCI6IGZhbHNlLFxyXG4gICAgICAgICAgICBcInNwYXduVHlwZVwiOiBcInBvaW50XCJcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlQmFsbEV4cGxvZGVQYXJ0aWNsZXMoYmFsbCkge1xyXG4gICAgaWYgKGJhbGwpIHtcclxuICAgICAgICBpbml0VW51c2VkRW1pdHRlcih7XHJcbiAgICAgICAgICAgIFwiYWxwaGFcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJzdGFydFwiOiAwLjgsXHJcbiAgICAgICAgICAgICAgICBcImVuZFwiOiAwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwic2NhbGVcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJzdGFydFwiOiAxIC8gMjQgKiBiYWxsLnNpemUsXHJcbiAgICAgICAgICAgICAgICBcImVuZFwiOiAgIDEgLyA0OCAqIGJhbGwuc2l6ZSxcclxuICAgICAgICAgICAgICAgIFwibWluaW11bVNjYWxlTXVsdGlwbGllclwiOiAxXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiY29sb3JcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJzdGFydFwiOiBiYWxsLmNvbG9ySGV4LFxyXG4gICAgICAgICAgICAgICAgXCJlbmRcIjogXCIjMzMzMzMzXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJzcGVlZFwiOiB7XHJcbiAgICAgICAgICAgICAgICBcInN0YXJ0XCI6IDUwICogYmFsbC5zaXplLFxyXG4gICAgICAgICAgICAgICAgXCJlbmRcIjogMTAgKiBiYWxsLnNpemVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJhY2NlbGVyYXRpb25cIjoge1xyXG4gICAgICAgICAgICAgICAgXCJ4XCI6IDAsXHJcbiAgICAgICAgICAgICAgICBcInlcIjogMFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBcInN0YXJ0Um90YXRpb25cIjoge1xyXG4gICAgICAgICAgICAgICAgXCJtaW5cIjogMCxcclxuICAgICAgICAgICAgICAgIFwibWF4XCI6IDM2MFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBcInJvdGF0aW9uU3BlZWRcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJtaW5cIjogMCxcclxuICAgICAgICAgICAgICAgIFwibWF4XCI6IDBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJsaWZldGltZVwiOiB7XHJcbiAgICAgICAgICAgICAgICBcIm1pblwiOiAwLjEsXHJcbiAgICAgICAgICAgICAgICBcIm1heFwiOiAwLjVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJibGVuZE1vZGVcIjogXCJub3JtYWxcIixcclxuICAgICAgICAgICAgXCJmcmVxdWVuY3lcIjogMC4wMSxcclxuICAgICAgICAgICAgXCJlbWl0dGVyTGlmZXRpbWVcIjogMC4xNSxcclxuICAgICAgICAgICAgXCJtYXhQYXJ0aWNsZXNcIjogMzIsXHJcbiAgICAgICAgICAgIFwicG9zXCI6IHtcclxuICAgICAgICAgICAgICAgIFwieFwiOiBiYWxsLnggKyBiYWxsLnNpemUgLyAyLFxyXG4gICAgICAgICAgICAgICAgXCJ5XCI6IGJhbGwueSArIGJhbGwuc2l6ZSAvIDJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJhZGRBdEJhY2tcIjogZmFsc2UsXHJcbiAgICAgICAgICAgIFwic3Bhd25UeXBlXCI6IFwicG9pbnRcIlxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRFbWl0dGVycygpIHtcclxuICAgIHJldHVybiBlbWl0dGVycztcclxufVxyXG5cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGluaXQ6IGluaXQsXHJcbiAgICB1cGRhdGU6IHVwZGF0ZSxcclxuICAgIGNyZWF0ZUJhbGxDb2xsaWRlUGFydGljbGVzOiBjcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyxcclxuICAgIGNyZWF0ZUJhbGxFeHBsb2RlUGFydGljbGVzOiBjcmVhdGVCYWxsRXhwbG9kZVBhcnRpY2xlcyxcclxuICAgIGdldEVtaXR0ZXJzOiBnZXRFbWl0dGVyc1xyXG59O1xyXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiaHRaa3g0XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvcGFydGljbGVzTWFuYWdlci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcblZlY3RvcjIgPSByZXF1aXJlKCAnLi9jbGFzcy9WZWN0b3IyJyApO1xyXG5cclxuXHJcbnZhciBjdXJyZW50RGVsdGEgPSAwLFxyXG4gICAgY3VycmVudERlYyA9IG5ldyBWZWN0b3IyKCksXHJcbiAgICBjdXJyZW50UmF0aW8gPSAxLFxyXG4gICAgc2FmZXR5R2FwU2l6ZSA9IDYsXHJcbiAgICByYWNrZXRzTWFyZ2luID0gMzQ7XHJcblxyXG5cclxuZnVuY3Rpb24gaW5pdCgpIHtcclxuXHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGUoIGRlbHRhICkge1xyXG5cclxuICAgIGN1cnJlbnREZWx0YSA9IGRlbHRhO1xyXG5cclxuICAgIGlmICggY3VycmVudERlbHRhICkge1xyXG5cclxuICAgICAgICB1cGRhdGVSYWNrZXRzKCk7XHJcbiAgICAgICAgdXBkYXRlQmFsbHMoKTtcclxuXHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldFZlbCggb2JqZWN0LCB2ZWwgKSB7XHJcblxyXG4gICAgb2JqZWN0LnZlbC5jb3B5KCB2ZWwgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFkZFZlbCggb2JqZWN0LCB2ZWwgKSB7XHJcblxyXG4gICAgb2JqZWN0LnZlbC5hZGRTZWxmKCB2ZWwgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZVJhY2tldHMoKSB7XHJcblxyXG4gICAgdXBkYXRlUmFja2V0KCByYWNrZXRzTWFuYWdlci5nZXRMZWZ0UmFja2V0KCkgKTtcclxuICAgIHVwZGF0ZVJhY2tldCggcmFja2V0c01hbmFnZXIuZ2V0UmlnaHRSYWNrZXQoKSApO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gdXBkYXRlUmFja2V0KCByYWNrZXQgKSB7XHJcblxyXG4gICAgaWYgKCBNYXRoLmFicyggcmFja2V0LnkgLSByYWNrZXQubW92aW5nVG9ZICkgPiAxICkge1xyXG5cclxuICAgICAgICByYWNrZXQueSArPSAoIHJhY2tldC5tb3ZpbmdUb1kgLSByYWNrZXQueSApICogOCAqIGN1cnJlbnREZWx0YTtcclxuXHJcbiAgICB9IGVsc2Uge1xyXG5cclxuICAgICAgICByYWNrZXQueSA9IHJhY2tldC5tb3ZpbmdUb1k7XHJcblxyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVCYWxscygpIHtcclxuXHJcbiAgICBiYWxsc01hbmFnZXIuZ2V0QmFsbHMoKS5mb3JFYWNoKCB1cGRhdGVCYWxsICk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVCYWxsKCBiYWxsLCBpbmRleCApIHtcclxuXHJcbiAgICBpZiAoIGJhbGwgJiYgYmFsbC5waHlzaWNzICkge1xyXG5cclxuICAgICAgICBpZiAoIGJhbGwudmVsLnggPj0gLTUwICYmIGJhbGwudmVsLnggPD0gNTAgKSB7XHJcblxyXG4gICAgICAgICAgICBiYWxsLnZlbC54ID0gYmFsbC52ZWwueCArIGJhbGwudmVsLnggKiAwLjE7XHJcblxyXG4gICAgICAgIH1cclxuICAgICAgICBjaGVja0JhbGxDb2xsaXNpb24oIGJhbGwgKTtcclxuICAgICAgICB1cGRhdGVPYmplY3RQb3MoIGJhbGwgKTtcclxuICAgICAgICBhcHBseU1hZ25ldEZvcmNlKCBiYWxsICk7XHJcblxyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVPYmplY3RQb3MoIG9iamVjdCApIHtcclxuXHJcbiAgICBvYmplY3QueCA9IG9iamVjdC54ICsgb2JqZWN0LnZlbC54ICogY3VycmVudERlbHRhO1xyXG4gICAgb2JqZWN0LnkgPSBvYmplY3QueSArIG9iamVjdC52ZWwueSAqIGN1cnJlbnREZWx0YTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNoZWNrQmFsbENvbGxpc2lvbiggYmFsbCApIHtcclxuICAgIGJhbGwubmV4dFggPSBiYWxsLnggKyBiYWxsLnZlbC54ICogY3VycmVudERlbHRhO1xyXG4gICAgYmFsbC5uZXh0WSA9IGJhbGwueSArIGJhbGwudmVsLnkgKiBjdXJyZW50RGVsdGE7XHJcblxyXG4gICAgLy8gVGVzdCB0b3AgY29sbGlzaW9uXHJcbiAgICBpZiAoIGJhbGwubmV4dFkgPD0gMCApIHtcclxuXHJcbiAgICAgICAgYmFsbC55ID0gMDtcclxuXHJcbiAgICAgICAgaWYgKCBiYWxsLm91dCApIHtcclxuXHJcbiAgICAgICAgICAgIGJhbGxzTWFuYWdlci5vbkJhbGxPdXREZXN0cm95KCBiYWxsICk7XHJcblxyXG4gICAgICAgIH0gZWxzZSB7XHJcblxyXG4gICAgICAgICAgICBvbkJhbGxDb2xsaWRlVG9wKCBiYWxsICk7XHJcblxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBUZXN0IGJvdHRvbSBjb2xsaXNpb25cclxuICAgIGVsc2UgaWYgKCBiYWxsLm5leHRZICsgYmFsbC5zaXplID49IGdhbWVDb25maWcuYmFzZVNjZW5lSGVpZ2h0ICkge1xyXG5cclxuICAgICAgICBiYWxsLnkgPSBnYW1lQ29uZmlnLmJhc2VTY2VuZUhlaWdodCAtIGJhbGwuc2l6ZTtcclxuXHJcbiAgICAgICAgaWYgKCBiYWxsLm91dCApIHtcclxuXHJcbiAgICAgICAgICAgIGJhbGxzTWFuYWdlci5vbkJhbGxPdXREZXN0cm95KCBiYWxsICk7XHJcblxyXG4gICAgICAgIH0gZWxzZSB7XHJcblxyXG4gICAgICAgICAgICBvbkJhbGxDb2xsaWRlQm90dG9tKCBiYWxsICk7XHJcblxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBJZiBiYWxsIGlzIG5vdCBvdXQgb2YgdGhlIGdhbWVcclxuICAgIGlmICggIWJhbGwub3V0ICkge1xyXG5cclxuICAgICAgICAvLyBUZXN0IGxlZnQgY29sbGlzaW9uXHJcbiAgICAgICAgaWYgKCBiYWxsLm5leHRYIDw9IHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXRCb3VuZHNSaWdodFgoKSAmJlxyXG4gICAgICAgICAgICBiYWxsLnggPj0gcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc1JpZ2h0WCgpICkge1xyXG5cclxuICAgICAgICAgICAgLy8gSWYgdGhlIGJhbGwgdG91Y2hlcyBsZWZ0IHJhY2tldFxyXG4gICAgICAgICAgICBpZiAoIGJhbGwubmV4dFkgKyBiYWxsLnNpemUgPiByYWNrZXRzTWFuYWdlci5nZXRMZWZ0UmFja2V0Qm91bmRzVG9wWSgpICYmXHJcbiAgICAgICAgICAgICAgICBiYWxsLm5leHRZIDwgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc0JvdHRvbVkoKSApIHtcclxuXHJcbiAgICAgICAgICAgICAgICBiYWxsLnggPSByYWNrZXRzTWFuYWdlci5nZXRMZWZ0UmFja2V0Qm91bmRzUmlnaHRYKCk7XHJcbiAgICAgICAgICAgICAgICBvbkJhbGxDb2xsaWRlTGVmdCggYmFsbCApO1xyXG5cclxuICAgICAgICAgICAgfSBlbHNlIGlmICggYmFsbC5uZXh0WCA8IHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXRCb3VuZHNSaWdodFgoKSApIHtcclxuXHJcbiAgICAgICAgICAgICAgICBiYWxsc01hbmFnZXIub25CYWxsT3V0KCBiYWxsICk7XHJcblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIFRlc3QgcmlnaHQgY29sbGlzaW9uXHJcbiAgICAgICAgZWxzZSBpZiAoIGJhbGwubmV4dFggKyBiYWxsLnNpemUgPj0gcmFja2V0c01hbmFnZXIuZ2V0UmlnaHRSYWNrZXRCb3VuZHNMZWZ0WCgpICYmXHJcbiAgICAgICAgICAgIGJhbGwueCArIGJhbGwuc2l6ZSA8PSByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldEJvdW5kc0xlZnRYKCkgKSB7XHJcblxyXG4gICAgICAgICAgICAvLyBJZiB0aGUgYmFsbCB0b3VjaGVzIHJpZ2h0IHJhY2tldFxyXG4gICAgICAgICAgICBpZiAoIGJhbGwubmV4dFkgKyBiYWxsLnNpemUgPiByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldEJvdW5kc1RvcFkoKSAmJlxyXG4gICAgICAgICAgICAgICAgYmFsbC5uZXh0WSA8IHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0Qm91bmRzQm90dG9tWSgpICkge1xyXG5cclxuICAgICAgICAgICAgICAgIGJhbGwueCA9IHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0Qm91bmRzTGVmdFgoKSAtIGJhbGwuc2l6ZTtcclxuICAgICAgICAgICAgICAgIG9uQmFsbENvbGxpZGVSaWdodCggYmFsbCApO1xyXG5cclxuICAgICAgICAgICAgfSBlbHNlIGlmICggYmFsbC5uZXh0WCArIGJhbGwuc2l6ZSA+IHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0Qm91bmRzTGVmdFgoKSApIHtcclxuXHJcbiAgICAgICAgICAgICAgICBiYWxsc01hbmFnZXIub25CYWxsT3V0KCBiYWxsICk7XHJcblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIElmIGJhbGwgaXMgb3V0LCB0ZXN0IGNvbGxpc2lvbiB3aXRoIHRvcCAmIGJvdHRvbSBvZiByYWNrZXRzXHJcbiAgICBpZiAoIGJhbGwub3V0ICkge1xyXG5cclxuICAgICAgICAvLyBCYWxsIG5lZWRzIHRvIGJlIGRlc3Ryb3lcclxuICAgICAgICBpZiAoIGJhbGwubmV4dFggKyBiYWxsLndpZHRoIDwgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc0xlZnRYKCkgLSA0MCAqIGN1cnJlbnRSYXRpbyB8fFxyXG4gICAgICAgICAgICBiYWxsLm5leHRYID4gcmFja2V0c01hbmFnZXIuZ2V0UmlnaHRSYWNrZXRCb3VuZHNSaWdodFgoKSArIDQwICogY3VycmVudFJhdGlvICkge1xyXG5cclxuICAgICAgICAgICAgYmFsbHNNYW5hZ2VyLm9uQmFsbE91dERlc3Ryb3koIGJhbGwgKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBMZWZ0IHJhY2tldFxyXG4gICAgICAgIGVsc2UgaWYgKCBiYWxsLm5leHRYIDwgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc1JpZ2h0WCgpICYmXHJcbiAgICAgICAgICAgIGJhbGwubmV4dFkgKyBiYWxsLmhlaWdodCA+IHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXRCb3VuZHNUb3BZKCkgJiZcclxuICAgICAgICAgICAgYmFsbC5uZXh0WSA8IHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXRCb3VuZHNCb3R0b21ZKCkgKSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgbGVmdFJhY2tldENlbnRlclkgPSAoIHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXRCb3VuZHNUb3BZKCkgKyByYWNrZXRzTWFuYWdlci5nZXRMZWZ0UmFja2V0Qm91bmRzQm90dG9tWSgpICkgKiAwLjU7XHJcblxyXG4gICAgICAgICAgICAvLyBjb2xsaWRlIHRvcCBvZiByYWNrZXRcclxuICAgICAgICAgICAgaWYgKCBiYWxsLnZlbC55ID4gMCApIHtcclxuXHJcbiAgICAgICAgICAgICAgICBvbkJhbGxDb2xsaWRlVG9wKCBiYWxsICk7XHJcblxyXG4gICAgICAgICAgICAgICAgYmFsbC55ID0gcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc1RvcFkoKSAtIGJhbGwuaGVpZ2h0IC0gMiAqIHNhZmV0eUdhcFNpemU7XHJcblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIGNvbGxpZGUgYm90dG9tIG9mIHJhY2tldFxyXG4gICAgICAgICAgICBlbHNlIGlmICggYmFsbC52ZWwueSA8IDAgKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgb25CYWxsQ29sbGlkZUJvdHRvbSggYmFsbCApO1xyXG5cclxuICAgICAgICAgICAgICAgIGJhbGwueSA9IHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXRCb3VuZHNCb3R0b21ZKCkgKyAyICogc2FmZXR5R2FwU2l6ZTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFJpZ2h0IHJhY2tldFxyXG4gICAgICAgIGVsc2UgaWYgKCBiYWxsLm5leHRYICsgYmFsbC53aWR0aCA+IHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0Qm91bmRzTGVmdFgoKSAmJlxyXG4gICAgICAgICAgICBiYWxsLm5leHRZICsgYmFsbC5oZWlnaHQgPiByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldEJvdW5kc1RvcFkoKSAmJlxyXG4gICAgICAgICAgICBiYWxsLm5leHRZIDwgcmFja2V0c01hbmFnZXIuZ2V0UmlnaHRSYWNrZXRCb3VuZHNCb3R0b21ZKCkgKSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgcmlnaHRSYWNrZXRDZW50ZXJZID0gKCByYWNrZXRzTWFuYWdlci5nZXRMZWZ0UmFja2V0Qm91bmRzVG9wWSgpICsgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc0JvdHRvbVkoKSApICogMC41O1xyXG5cclxuICAgICAgICAgICAgLy8gY29sbGlkZSB0b3Agb2YgcmFja2V0XHJcbiAgICAgICAgICAgIGlmICggYmFsbC52ZWwueSA+IDAgKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCBiYWxsLnkgPCByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldCgpLnkgKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIG9uQmFsbENvbGxpZGVUb3AoIGJhbGwgKTtcclxuXHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgYmFsbC55ID0gKCByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldEJvdW5kc1RvcFkoKSAtIGJhbGwuaGVpZ2h0ICkgLSAyICogc2FmZXR5R2FwU2l6ZTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gY29sbGlkZSBib3R0b20gb2YgcmFja2V0XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKCBiYWxsLnZlbC55IDwgMCApIHtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIGJhbGwueSA+IHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0KCkueSApIHtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgb25CYWxsQ29sbGlkZUJvdHRvbSggYmFsbCApO1xyXG5cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBiYWxsLnkgPSByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldEJvdW5kc0JvdHRvbVkoKSArIDIgKiBzYWZldHlHYXBTaXplO1xyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gb25CYWxsQ29sbGlkZVRvcCggYmFsbCApIHtcclxuXHJcbiAgICBiYWxsLnZlbC55ID0gLWJhbGwudmVsLnk7XHJcbiAgICBiYWxsLnZlbC54ICs9IGJhbGwudmVsLnggKiAwLjAyO1xyXG4gICAgaWYgKCAhYmFsbC5vdXQgKSB7XHJcblxyXG4gICAgICAgIHN5bmNNYW5hZ2VyLm9uVXBkYXRlQmFsbCggYmFsbCwgJ3QnICk7XHJcblxyXG4gICAgfVxyXG4gICAgcGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyggYmFsbCwgOTAgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQmFsbENvbGxpZGVCb3R0b20oIGJhbGwgKSB7XHJcblxyXG4gICAgYmFsbC52ZWwueSA9IC1iYWxsLnZlbC55O1xyXG4gICAgYmFsbC52ZWwueCArPSBiYWxsLnZlbC54ICogMC4wMjtcclxuICAgIGlmICggIWJhbGwub3V0ICkge1xyXG5cclxuICAgICAgICBzeW5jTWFuYWdlci5vblVwZGF0ZUJhbGwoIGJhbGwsICdiJyApO1xyXG5cclxuICAgIH1cclxuICAgIHBhcnRpY2xlc01hbmFnZXIuY3JlYXRlQmFsbENvbGxpZGVQYXJ0aWNsZXMoIGJhbGwsIDI3MCApO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gb25CYWxsQ29sbGlkZUxlZnQoIGJhbGwgKSB7XHJcblxyXG4gICAgYmFsbC52ZWwueCA9IC1iYWxsLnZlbC54O1xyXG4gICAgc3luY01hbmFnZXIub25VcGRhdGVCYWxsKCBiYWxsLCAnbCcgKTtcclxuICAgIHBhcnRpY2xlc01hbmFnZXIuY3JlYXRlQmFsbENvbGxpZGVQYXJ0aWNsZXMoIGJhbGwsIDAgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQmFsbENvbGxpZGVSaWdodCggYmFsbCApIHtcclxuXHJcbiAgICBiYWxsLnZlbC54ID0gLWJhbGwudmVsLng7XHJcbiAgICBzeW5jTWFuYWdlci5vblVwZGF0ZUJhbGwoIGJhbGwsICdyJyApO1xyXG4gICAgcGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyggYmFsbCwgMTgwICk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBhcHBseU1hZ25ldEZvcmNlKCBiYWxsICkge1xyXG5cclxuICAgIGlmICggYmFsbC52ZWwueCA8IDAgKSB7XHJcbiAgICAgICAgLy8gYmFsbC52ZWwueSA9IChiYWxsLnZlbC55IC0gKHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXQoKS5nZXRDZW50ZXIoKS55IC0gYmFsbC55KSAqIDAuMSk7XHJcbiAgICAgICAgLy8gYmFsbC52ZWwueSA9IGJhbGwudmVsLnkgKyAoMS8oYmFsbC55IC0gcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldCgpLmdldENlbnRlcigpLnkpKSAqIDEwXHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coYmFsbC55IC0gcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldCgpLmdldENlbnRlcigpLnkpO1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gdXBkYXRlU2NlbmVSZXNpemVWYWx1ZXMoIGRlYywgcmF0aW8gKSB7XHJcblxyXG4gICAgY3VycmVudERlYyA9IGRlYztcclxuICAgIGN1cnJlbnRSYXRpbyA9IHJhdGlvO1xyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBpbml0OiBpbml0LFxyXG4gICAgdXBkYXRlOiB1cGRhdGUsXHJcbiAgICBzZXRWZWw6IHNldFZlbCxcclxuICAgIGFkZFZlbDogYWRkVmVsLFxyXG4gICAgdXBkYXRlU2NlbmVSZXNpemVWYWx1ZXM6IHVwZGF0ZVNjZW5lUmVzaXplVmFsdWVzXHJcbn07XHJcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9waHlzaWNzRW5naW5lLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIFJhY2tldCA9IHJlcXVpcmUoJy4vY2xhc3MvUmFja2V0Jyk7XHJcblxyXG5cclxudmFyIHBsYXllclNpZGUgPSAnbGVmdCcsXHJcbiAgICBvcHBvbmVudFNpZGUgPSAncmlnaHQnLFxyXG4gICAgcmFja2V0cyA9IHtcclxuICAgICAgICBsZWZ0OiBudWxsLFxyXG4gICAgICAgIHJpZ2h0OiBudWxsXHJcbiAgICB9LFxyXG4gICAgbWFyZ2luID0gMzA7XHJcblxyXG5mdW5jdGlvbiBpbml0KHNjZW5lKSB7XHJcblxyXG4gICAgcmFja2V0cy5sZWZ0ID0gbmV3IFJhY2tldCgpO1xyXG5cclxuICAgIHJhY2tldHMucmlnaHQgPSBuZXcgUmFja2V0KCk7XHJcblxyXG4gICAgcmVzZXRSYWNrZXRzUG9zaXRpb25zKCk7XHJcblxyXG4gICAgc3RhZ2VNYW5hZ2VyLmdldFNjZW5lKCkuYWRkUmFja2V0KHJhY2tldHMubGVmdCk7XHJcbiAgICBzdGFnZU1hbmFnZXIuZ2V0U2NlbmUoKS5hZGRSYWNrZXQocmFja2V0cy5yaWdodCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlc2V0UmFja2V0c1Bvc2l0aW9ucygpIHtcclxuXHJcbiAgICB2YXIgY2VudGVyWSA9IHN0YWdlTWFuYWdlci5nZXRTY2VuZSgpLmdldENlbnRlcigpLnk7XHJcblxyXG4gICAgcmFja2V0cy5sZWZ0LnggPSBtYXJnaW47XHJcbiAgICByYWNrZXRzLmxlZnQueSA9IGNlbnRlclk7XHJcbiAgICByYWNrZXRzLnJpZ2h0LnggPSBnYW1lQ29uZmlnLmJhc2VTY2VuZVdpZHRoIC0gbWFyZ2luO1xyXG4gICAgcmFja2V0cy5yaWdodC55ID0gY2VudGVyWTtcclxuXHJcbiAgICBtb3ZlUGxheWVyUmFja2V0VG8oY2VudGVyWSk7XHJcbiAgICBtb3ZlT3Bwb25lbnRSYWNrZXRUbyhjZW50ZXJZKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldFBsYXllclNpZGUoaXNIb3N0KSB7XHJcblxyXG4gICAgcGxheWVyU2lkZSA9IGlzSG9zdCA/ICdsZWZ0JyA6ICdyaWdodCc7XHJcbiAgICBvcHBvbmVudFNpZGUgPSBpc0hvc3QgPyAncmlnaHQnIDogJ2xlZnQnO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gbW92ZVBsYXllclJhY2tldFRvKHksIGluc3RhbnQpIHtcclxuXHJcbiAgICByYWNrZXRzW3BsYXllclNpZGVdLnNldE1vdmluZ1RvWSh5KTtcclxuXHJcbiAgICBpZiAoaW5zdGFudCkge1xyXG5cclxuICAgICAgICByYWNrZXRzW3BsYXllclNpZGVdLnkgPSAocmFja2V0c1twbGF5ZXJTaWRlXS55ICsgeSkgKiAwLjU7XHJcblxyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBtb3ZlT3Bwb25lbnRSYWNrZXRUbyh5LCBpbnN0YW50KSB7XHJcblxyXG4gICAgcmFja2V0c1tvcHBvbmVudFNpZGVdLnNldE1vdmluZ1RvWSh5KTtcclxuXHJcbiAgICBpZiAoaW5zdGFudCkge1xyXG5cclxuICAgICAgICByYWNrZXRzW29wcG9uZW50U2lkZV0ueSA9IChyYWNrZXRzW29wcG9uZW50U2lkZV0ueSArIHkpICogMC41O1xyXG5cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gbW92ZVBsYXllclJhY2tldEJ5KHkpIHtcclxuXHJcbiAgICBtb3ZlUGxheWVyUmFja2V0VG8ocmFja2V0c1twbGF5ZXJTaWRlXS55ICsgeSk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRQbGF5ZXJSYWNrZXRZKCkge1xyXG5cclxuICAgIHJldHVybiByYWNrZXRzW3BsYXllclNpZGVdLnk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRPcHBvbmVudFJhY2tldFkoKSB7XHJcblxyXG4gICAgcmV0dXJuIHJhY2tldHNbb3Bwb25lbnRTaWRlXS55O1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0UGxheWVyUmFja2V0TW92aW5nVG9ZKCkge1xyXG5cclxuICAgIHJldHVybiByYWNrZXRzW3BsYXllclNpZGVdLm1vdmluZ1RvWTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExlZnRSYWNrZXQoKSB7XHJcblxyXG4gICAgcmV0dXJuIHJhY2tldHMubGVmdDtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFJpZ2h0UmFja2V0KCkge1xyXG5cclxuICAgIHJldHVybiByYWNrZXRzLnJpZ2h0O1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGVmdFJhY2tldEJvdW5kc1RvcFkoKSB7XHJcblxyXG4gICAgcmV0dXJuIHJhY2tldHMubGVmdC55IC0gcmFja2V0cy5sZWZ0LmhlaWdodCAvIDI7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRMZWZ0UmFja2V0Qm91bmRzQm90dG9tWSgpIHtcclxuXHJcbiAgICByZXR1cm4gcmFja2V0cy5sZWZ0LnkgKyByYWNrZXRzLmxlZnQuaGVpZ2h0IC8gMjtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExlZnRSYWNrZXRCb3VuZHNMZWZ0WCgpIHtcclxuXHJcbiAgICByZXR1cm4gcmFja2V0cy5sZWZ0LnggLSByYWNrZXRzLmxlZnQud2lkdGggLyAyO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGVmdFJhY2tldEJvdW5kc1JpZ2h0WCgpIHtcclxuXHJcbiAgICByZXR1cm4gcmFja2V0cy5sZWZ0LnggKyByYWNrZXRzLmxlZnQud2lkdGggLyAyO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0UmlnaHRSYWNrZXRCb3VuZHNUb3BZKCkge1xyXG5cclxuICAgIHJldHVybiByYWNrZXRzLnJpZ2h0LnkgLSByYWNrZXRzLnJpZ2h0LmhlaWdodCAvIDI7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRSaWdodFJhY2tldEJvdW5kc0JvdHRvbVkoKSB7XHJcblxyXG4gICAgcmV0dXJuIHJhY2tldHMucmlnaHQueSArIHJhY2tldHMucmlnaHQuaGVpZ2h0IC8gMjtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFJpZ2h0UmFja2V0Qm91bmRzTGVmdFgoKSB7XHJcblxyXG4gICAgcmV0dXJuIHJhY2tldHMucmlnaHQueCAtIHJhY2tldHMucmlnaHQud2lkdGggLyAyO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0UmlnaHRSYWNrZXRCb3VuZHNSaWdodFgoKSB7XHJcblxyXG4gICAgcmV0dXJuIHJhY2tldHMucmlnaHQueCArIHJhY2tldHMucmlnaHQud2lkdGggLyAyO1xyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBpbml0OiBpbml0LFxyXG4gICAgcmVzZXRSYWNrZXRzUG9zaXRpb25zOiByZXNldFJhY2tldHNQb3NpdGlvbnMsXHJcbiAgICBzZXRQbGF5ZXJTaWRlOiBzZXRQbGF5ZXJTaWRlLFxyXG4gICAgbW92ZVBsYXllclJhY2tldFRvOiBtb3ZlUGxheWVyUmFja2V0VG8sXHJcbiAgICBtb3ZlT3Bwb25lbnRSYWNrZXRUbzogbW92ZU9wcG9uZW50UmFja2V0VG8sXHJcbiAgICBtb3ZlUGxheWVyUmFja2V0Qnk6IG1vdmVQbGF5ZXJSYWNrZXRCeSxcclxuICAgIGdldFBsYXllclJhY2tldFk6IGdldFBsYXllclJhY2tldFksXHJcbiAgICBnZXRPcHBvbmVudFJhY2tldFk6IGdldE9wcG9uZW50UmFja2V0WSxcclxuICAgIGdldFBsYXllclJhY2tldE1vdmluZ1RvWTogZ2V0UGxheWVyUmFja2V0TW92aW5nVG9ZLFxyXG4gICAgZ2V0TGVmdFJhY2tldDogZ2V0TGVmdFJhY2tldCxcclxuICAgIGdldFJpZ2h0UmFja2V0OiBnZXRSaWdodFJhY2tldCxcclxuICAgIGdldExlZnRSYWNrZXRCb3VuZHNUb3BZOiBnZXRMZWZ0UmFja2V0Qm91bmRzVG9wWSxcclxuICAgIGdldExlZnRSYWNrZXRCb3VuZHNMZWZ0WDogZ2V0TGVmdFJhY2tldEJvdW5kc0xlZnRYLFxyXG4gICAgZ2V0TGVmdFJhY2tldEJvdW5kc0JvdHRvbVk6IGdldExlZnRSYWNrZXRCb3VuZHNCb3R0b21ZLFxyXG4gICAgZ2V0TGVmdFJhY2tldEJvdW5kc1JpZ2h0WDogZ2V0TGVmdFJhY2tldEJvdW5kc1JpZ2h0WCxcclxuICAgIGdldFJpZ2h0UmFja2V0Qm91bmRzVG9wWTogZ2V0UmlnaHRSYWNrZXRCb3VuZHNUb3BZLFxyXG4gICAgZ2V0UmlnaHRSYWNrZXRCb3VuZHNMZWZ0WDogZ2V0UmlnaHRSYWNrZXRCb3VuZHNMZWZ0WCxcclxuICAgIGdldFJpZ2h0UmFja2V0Qm91bmRzQm90dG9tWTogZ2V0UmlnaHRSYWNrZXRCb3VuZHNCb3R0b21ZLFxyXG4gICAgZ2V0UmlnaHRSYWNrZXRCb3VuZHNSaWdodFg6IGdldFJpZ2h0UmFja2V0Qm91bmRzUmlnaHRYXHJcbn07XHJcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9yYWNrZXRzTWFuYWdlci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBzb2NrZXQsXHJcbiAgICBjb25uZWN0aW9uSUQsXHJcbiAgICBzZXJ2ZXJDb25maWcsXHJcbiAgICBjb250cm9sTW9kZTtcclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcblxyXG5cdCQuZ2V0SlNPTihcImNvbmZpZy5qc29uXCIsIGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgICAgICBzZXJ2ZXJDb25maWcgPSBkYXRhO1xyXG4gICAgICAgIHZhciBhZGRyZXNzID0gc2VydmVyQ29uZmlnLnVybCArIFwiOlwiICsgc2VydmVyQ29uZmlnLnBvcnQ7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGFkZHJlc3MpO1xyXG4gICAgICAgICQuZ2V0U2NyaXB0KCdodHRwOi8vJyArIGFkZHJlc3MgKyAnL3NvY2tldC5pby9zb2NrZXQuaW8uanMnKVxyXG4gICAgICAgICAgICAuZG9uZShmdW5jdGlvbiggKSB7XHJcbiAgICAgICAgICAgICAgICBpbml0U29ja2V0KCdodHRwOi8vJyArIGFkZHJlc3MpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdFNvY2tldChhZGRyZXNzKSB7XHJcblxyXG4gICAgc29ja2V0ID0gaW8uY29ubmVjdChhZGRyZXNzKTtcclxuICAgIGNvbnNvbGUubG9nKCdpbml0IHNvY2tldCcsIHNvY2tldCk7XHJcblxyXG4gICAgc2VuZEhvc3RSZXF1ZXN0KCk7XHJcbiAgICBiaW5kU29ja2V0RXZlbnRzKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlbmRIb3N0UmVxdWVzdCgpIHtcclxuICAgIHNvY2tldC5lbWl0KCduZXdIb3N0aW5nJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJpbmRTb2NrZXRFdmVudHMoKSB7XHJcbiAgICBzb2NrZXQub24oJ25ld0Nvbm5lY3Rpb25JRCcsIG9uTmV3Q29ubmVjdGlvbklEKTtcclxuICAgIHNvY2tldC5vbignY29ubmVjdGlvblJlYWR5Jywgb25Db25uZWN0aW9uUmVhZHkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbk5ld0Nvbm5lY3Rpb25JRChkYXRhKSB7XHJcbiAgICBzb2NrZXQucmVtb3ZlTGlzdGVuZXIoJ25ld0Nvbm5lY3Rpb25JRCcpO1xyXG5cclxuICAgIGNvbm5lY3Rpb25JRCA9IGRhdGEuY29ubmVjdGlvbklEO1xyXG4gICAgXHJcbiAgICAvL2Rpc3BsYXkgdGV4dCArIHFyY29kZVxyXG4gICAgdmFyICRjb250YWluZXIgPSAkKCcjaW5mby1jb25uZWN0aW9uJykuc2hvdygpLFxyXG4gICAgICAgICR1cmwgPSAkKCcubW9iaWxlLXVybCcsICRjb250YWluZXIpLFxyXG4gICAgICAgICRxcmNvZGUgPSAkKCcjcXItc2NhbicsICRjb250YWluZXIpO1xyXG5cclxuICAgIHZhciB1cmxNb2JpbGUgICA9IHNlcnZlckNvbmZpZy51cmwgKyAnOicgKyBzZXJ2ZXJDb25maWcucG9ydCArICcvbW9iaWxlP2lkPScgKyBkYXRhLmNvbm5lY3Rpb25JRDtcclxuXHJcbiAgICAkdXJsLnRleHQodXJsTW9iaWxlKTtcclxuICAgICRxcmNvZGUucXJjb2RlKHt3aWR0aDonMjAwJywgaGVpZ2h0OicyMDAnLCB0ZXh0OnVybE1vYmlsZX0pO1xyXG5cclxuICAgICQoJyNkZXNrdG9wLW9ubHknKS5vbignY2xpY2snLCBvbkNsaWNrRGVza3RvcE9ubHkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbkNsaWNrRGVza3RvcE9ubHkoKSB7XHJcbiAgICBzb2NrZXQuZW1pdCgnZGVza3RvcE9ubHknLCBjb25uZWN0aW9uSUQpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbkNvbm5lY3Rpb25SZWFkeShtb2RlKSB7XHJcbiAgICAkKCcjaW5mby1jb25uZWN0aW9uJykuaGlkZSgpO1xyXG4gICAgc29ja2V0LnJlbW92ZUxpc3RlbmVyKCdjb25ubmVjdGlvblJlYWR5Jyk7XHJcblxyXG4gICAgaW5pdEFwcCgpO1xyXG5cclxuICAgIGFwcE1hbmFnZXIub25Db25uZWN0aW9uUmVhZHkobW9kZSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGluaXRBcHAgKCkge1xyXG5cclxuICAgIHZhciAkY29udGFpbmVySW5mbyA9ICQoJyNjb250YWluZXItaW5mbycpLnNob3coKTtcclxuICAgIHZhciAkZ2FtZVN0YXRlID0gJCgnI2dhbWUtc3RhdGUnKTtcclxuICAgIHZhciAkcGxheWVyQ29udHJvbERhdGEgPSAkKCcjcGxheWVyLWNvbnRyb2wtZGF0YScpO1xyXG4gICAgdmFyICRvcHBvbmVudENvbnRyb2xEYXRhID0gJCgnI29wcG9uZW50LWNvbnRyb2wtZGF0YScpO1xyXG5cclxuICAgIHZhciBpc0hvc3Q7XHJcbiAgICB2YXIgZ2FtZVJvb21JRDtcclxuXHJcbiAgICBzb2NrZXQub24oJ21vYmlsZSB0b3AnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgZGVzdFkgPSByYWNrZXRzTWFuYWdlci5nZXRQbGF5ZXJSYWNrZXRZKCkgLSAzNDA7XHJcbiAgICAgICAgcmFja2V0c01hbmFnZXIubW92ZVBsYXllclJhY2tldFRvKCBkZXN0WSwgZmFsc2UgKTtcclxuICAgICAgICBzeW5jTWFuYWdlci5vblJhY2tldFNldE1vdmluZ1RvWSggZGVzdFkgKTtcclxuICAgICAgICAvLyBodWRNYW5hZ2VyLnNldERlYnVnMVRleHQoJ1lPVTogdG9wJyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzb2NrZXQub24oJ21vYmlsZSBib3R0b20nLCBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgZGVzdFkgPSByYWNrZXRzTWFuYWdlci5nZXRQbGF5ZXJSYWNrZXRZKCkgKyAzNDA7XHJcbiAgICAgICAgcmFja2V0c01hbmFnZXIubW92ZVBsYXllclJhY2tldFRvKCBkZXN0WSwgZmFsc2UgKTtcclxuICAgICAgICBzeW5jTWFuYWdlci5vblJhY2tldFNldE1vdmluZ1RvWSggZGVzdFkgKTtcclxuICAgICAgICAvLyBodWRNYW5hZ2VyLnNldERlYnVnMVRleHQoJ1lPVTogYm90dG9tJyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzb2NrZXQub24oJ21vYmlsZSBzdG9wJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgLy8gaHVkTWFuYWdlci5zZXREZWJ1ZzFUZXh0KCdZT1U6ICcpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgc29ja2V0Lm9uKCdvcHBvbmVudCB0b3AnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICByYWNrZXRzTWFuYWdlci5tb3ZlT3Bwb25lbnRSYWNrZXRUbyggcmFja2V0c01hbmFnZXIuZ2V0T3Bwb25lbnRSYWNrZXRZKCkgLSAzNDAsIGZhbHNlICk7XHJcblxyXG4gICAgICAgIC8vIGh1ZE1hbmFnZXIuc2V0RGVidWcyVGV4dCgnSElNOiB0b3AnKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignb3Bwb25lbnQgYm90dG9tJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmFja2V0c01hbmFnZXIubW92ZU9wcG9uZW50UmFja2V0VG8oIHJhY2tldHNNYW5hZ2VyLmdldE9wcG9uZW50UmFja2V0WSgpICsgMzQwLCBmYWxzZSApO1xyXG5cclxuICAgICAgICAvLyBodWRNYW5hZ2VyLnNldERlYnVnMlRleHQoJ0hJTTogYm90dG9tJyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzb2NrZXQub24oJ29wcG9uZW50IHN0b3AnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAvLyBodWRNYW5hZ2VyLnNldERlYnVnMlRleHQoJ0hJTTogJyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzb2NrZXQub24oJ29wcG9uZW50IGRpc2Nvbm5lY3QnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnZGlzY29ubmVjdGVkJyk7XHJcbiAgICAgICAgaHVkTWFuYWdlci5zZXRJbmZvc1RleHQoJ09wcG9uZW50IGRpc2Nvbm5lY3RlZC4uLicpO1xyXG4gICAgICAgIGFwcE1hbmFnZXIub25PcHBvbmVudERpc2Nvbm5lY3QoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignZ2FtZSBqb2luZWQnLCBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICAgICAgaXNIb3N0ID0gZGF0YS5pc0hvc3Q7XHJcbiAgICAgICAgZ2FtZVJvb21JRCA9IGRhdGEuZ2FtZVJvb21JRDtcclxuICAgICAgICBodWRNYW5hZ2VyLnNldEluZm9zVGV4dCgnR2FtZSAjJyArIGdhbWVSb29tSUQgKyAnIGpvaW5lZC4gXFxuV2FpdGluZyBmb3IgYW5vdGhlciBwbGF5ZXIuLi4nKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignZ2FtZSByZWFkeScsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmIChpc0hvc3QpIHtcclxuICAgICAgICAgICAgaHVkTWFuYWdlci5zZXRJbmZvc1RleHQoJ0dhbWUgIycgKyBnYW1lUm9vbUlEICsgJyBbSE9TVF0nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGh1ZE1hbmFnZXIuc2V0SW5mb3NUZXh0KCdHYW1lICMnICsgZ2FtZVJvb21JRCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGFwcE1hbmFnZXIub25HYW1lUmVhZHkoZ2FtZVJvb21JRCwgaXNIb3N0KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignc3luYycsIGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgICAgICBzeW5jTWFuYWdlci5vblN5bmMoZGF0YSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZW1pdChtZXNzYWdlLCBkYXRhKSB7XHJcbiAgICBzb2NrZXQuZW1pdChtZXNzYWdlLCBkYXRhKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcblx0aW5pdDogaW5pdCxcclxuICAgIGVtaXQ6IGVtaXRcclxufTtcclxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcImh0Wmt4NFwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3NvY2tldHNNYW5hZ2VyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIFNjZW5lID0gcmVxdWlyZSggJy4vY2xhc3MvU2NlbmUnICk7XHJcblxyXG52YXIgcmVuZGVyZXIsXHJcbiAgICBzdGFnZSxcclxuICAgIHNjZW5lLFxyXG4gICAgcGFydGljbGVzQ29udGFpbmVyLFxyXG4gICAgc3RhdHMsXHJcbiAgICBsYXN0VGltZSA9IDAsXHJcbiAgICBkZWx0YSA9IDAsXHJcbiAgICBkZWMgPSBuZXcgVmVjdG9yMigpLFxyXG4gICAgcmF0aW8gPSAxLFxyXG4gICAgcGl4ZWxhdGVGaWx0ZXIsXHJcbiAgICBiYWNrZ3JvdW5kLFxyXG4gICAgY29sb3JTdGVwRmlsdGVyLFxyXG4gICAgc2NhbkZpbHRlcixcclxuICAgIHJnYlNwbGl0RmlsdGVyLFxyXG4gICAgY2hlY2tEZWx0YUludGVydmFsLFxyXG4gICAgc3RhcnRUaW1lLFxyXG4gICAgZW1pdHRlcixcclxuICAgIGluYWN0aXZlID0gZmFsc2UsXHJcbiAgICBpc1BhdXNlZCA9IGZhbHNlO1xyXG5cclxuZnVuY3Rpb24gaW5pdCgpIHtcclxuXHJcbiAgICAvLyBjcmVhdGUgYW4gbmV3IGluc3RhbmNlIG9mIGEgcGl4aSBzdGFnZVxyXG4gICAgc3RhZ2UgPSBuZXcgUElYSS5TdGFnZSggMHgyMjIyMjIgKTtcclxuXHJcbiAgICAvLyBjcmVhdGUgYSByZW5kZXJlciBpbnN0YW5jZSBhbmQgYXBwZW5kIHRoZSB2aWV3IFxyXG4gICAgcmVuZGVyZXIgPSBQSVhJLmF1dG9EZXRlY3RSZW5kZXJlciggd2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCwgbnVsbCwgZmFsc2UsIHRydWUgKTtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZ2FtZScgKS5hcHBlbmRDaGlsZCggcmVuZGVyZXIudmlldyApO1xyXG5cclxuXHJcbiAgICB2YXIgdW5pZm9ybXMgPSB7fTtcclxuICAgIHVuaWZvcm1zLnBvd2VyID0ge1xyXG4gICAgICAgIHR5cGU6ICcxZicsXHJcbiAgICAgICAgdmFsdWU6IDEgLyAxMDAwXHJcbiAgICB9O1xyXG4gICAgdW5pZm9ybXMubm9pc2UgPSB7XHJcbiAgICAgICAgdHlwZTogJzFmJyxcclxuICAgICAgICB2YWx1ZTogMC4yXHJcbiAgICB9O1xyXG5cclxuICAgIC8vLy8gZ3JhaW4gZmlsdGVyLi5cclxuXHJcbiAgICB2YXIgZnJhZ21lbnRTcmMgPSBbXHJcblxyXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxyXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxyXG4gICAgICAgICd2YXJ5aW5nIHZlYzQgdkNvbG9yOycsXHJcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXHJcbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgbm9pc2U7JyxcclxuICAgICAgICAndW5pZm9ybSBmbG9hdCBwb3dlcjsnLFxyXG5cclxuICAgICAgICAnZmxvYXQgcmFuZCh2ZWMyIGNvKSB7JyxcclxuICAgICAgICAnICAgIHJldHVybiBmcmFjdChzaW4oZG90KGNvLnh5ICx2ZWMyKDEyLjk4OTgsNzguMjMzICogbm9pc2UpKSkgKiA0Mzc1OC41NDUzKTsnLFxyXG4gICAgICAgICd9JyxcclxuXHJcbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcclxuICAgICAgICAnICAgdmVjMiBjb3JkID0gdlRleHR1cmVDb29yZDsnLFxyXG4gICAgICAgICcgICBjb3JkLnkgKz0gbm9pc2UgKiAwLjAwMTsnLFxyXG5cclxuICAgICAgICAnICAgIHZlYzQgY29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZUZXh0dXJlQ29vcmQpOycsXHJcblxyXG4gICAgICAgICcgICAgZmxvYXQgZGlmZiA9IChyYW5kKHZUZXh0dXJlQ29vcmQpIC0gMC41KSAqIDAuMDc1OycsXHJcbiAgICAgICAgJyAgICBjb2xvci5yICs9IGRpZmY7JyxcclxuICAgICAgICAnICAgIGNvbG9yLmcgKz0gZGlmZjsnLFxyXG4gICAgICAgICcgICAgY29sb3IuYiArPSBkaWZmOycsXHJcblxyXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSBjb2xvcjsnLFxyXG4gICAgICAgICd9J1xyXG4gICAgXTtcclxuXHJcbiAgICBzY2FuRmlsdGVyID0gbmV3IFBJWEkuQWJzdHJhY3RGaWx0ZXIoIGZyYWdtZW50U3JjLCB1bmlmb3JtcyApO1xyXG5cclxuICAgIHJnYlNwbGl0RmlsdGVyID0gbmV3IFBJWEkuUkdCU3BsaXRGaWx0ZXIoKTtcclxuICAgIHNldFJHQlNwbGl0RmlsdGVyU2l6ZSggMyApO1xyXG5cclxuXHJcbiAgICBwaXhlbGF0ZUZpbHRlciA9IG5ldyBQSVhJLlBpeGVsYXRlRmlsdGVyKCk7XHJcbiAgICBwaXhlbGF0ZUZpbHRlci5zaXplLnggPSAzO1xyXG4gICAgcGl4ZWxhdGVGaWx0ZXIuc2l6ZS55ID0gMztcclxuXHJcbiAgICBzdGF0cyA9IG5ldyBTdGF0cygpO1xyXG4gICAgc3RhdHMuZG9tRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XHJcbiAgICBzdGF0cy5kb21FbGVtZW50LnN0eWxlLnJpZ2h0ID0gJzBweCc7XHJcbiAgICBzdGF0cy5kb21FbGVtZW50LnN0eWxlLnRvcCA9ICcwcHgnO1xyXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggc3RhdHMuZG9tRWxlbWVudCApO1xyXG5cclxuICAgIGJhY2tncm91bmQgPSBuZXcgUElYSS5HcmFwaGljcygpO1xyXG4gICAgYmFja2dyb3VuZC5iZWdpbkZpbGwoIDB4MTExMTExICk7XHJcbiAgICBiYWNrZ3JvdW5kLmRyYXdSZWN0KCAwLCAwLCB3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0ICk7XHJcbiAgICBzdGFnZS5hZGRDaGlsZCggYmFja2dyb3VuZCApO1xyXG5cclxuICAgIHNjZW5lID0gbmV3IFNjZW5lKCBnYW1lQ29uZmlnLmJhc2VTY2VuZVdpZHRoLCBnYW1lQ29uZmlnLmJhc2VTY2VuZUhlaWdodCApO1xyXG5cclxuICAgIHN0YWdlLmFkZENoaWxkKCBzY2VuZSApO1xyXG4gICAgdXBkYXRlR2FtZVNpemUoKTtcclxuXHJcbiAgICB3aW5kb3cub25yZXNpemUgPSB1cGRhdGVHYW1lU2l6ZTtcclxuXHJcbiAgICBzdGFnZS5maWx0ZXJzID0gWyBwaXhlbGF0ZUZpbHRlciwgcmdiU3BsaXRGaWx0ZXIgXTtcclxuICAgIC8vIHN0YWdlLmZpbHRlcnMgPSBbcGl4ZWxhdGVGaWx0ZXJdO1xyXG5cclxuICAgIGh1ZE1hbmFnZXIuaW5pdCgpO1xyXG4gICAgcmFja2V0c01hbmFnZXIuaW5pdCgpO1xyXG4gICAgcGh5c2ljc0VuZ2luZS5pbml0KCk7XHJcbiAgICBwYXJ0aWNsZXNNYW5hZ2VyLmluaXQoKTtcclxuXHJcblxyXG5cclxuICAgIHN0YXJ0VGltZSA9IGFwcE1hbmFnZXIuZ2V0U3RhcnRUaW1lKCk7XHJcbiAgICBjaGVja0RlbHRhSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCggY2hlY2tEZWx0YSwgZ2FtZUNvbmZpZy5jaGVja0RlbHRhSW50ZXJ2YWxUaW1lICk7XHJcbiAgICB1cGRhdGUoKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZSggdGltZSApIHtcclxuXHJcbiAgICByZXF1ZXN0QW5pbUZyYW1lKCB1cGRhdGUgKTtcclxuXHJcbiAgICBpZiAoIHRpbWUgKSB7XHJcblxyXG4gICAgICAgIGRlbHRhID0gKCB0aW1lIC0gbGFzdFRpbWUgKSAqIDAuMDAxO1xyXG4gICAgICAgIGxhc3RUaW1lID0gdGltZTtcclxuXHJcbiAgICAgICAgLy8gc2NhbkZpbHRlci51bmlmb3Jtcy5wb3dlci52YWx1ZSArPSAoZWFzZSAtICBzY2FuRmlsdGVyLnVuaWZvcm1zLnBvd2VyLnZhbHVlICkgKiAwLjM7XHJcblxyXG4gICAgICAgIC8vIHNjYW5GaWx0ZXIudW5pZm9ybXMubm9pc2UudmFsdWUgKz0gMC4xO1xyXG4gICAgICAgIC8vIHNjYW5GaWx0ZXIudW5pZm9ybXMubm9pc2UudmFsdWUgJT0gMTtcclxuICAgICAgICAvLyBzY2FuRmlsdGVyLnN5bmNVbmlmb3JtcygpO1xyXG5cclxuICAgICAgICBzZXRSR0JTcGxpdEZpbHRlclNpemUoIHRpbWUgKTtcclxuICAgICAgICBkZXNrdG9wQ29udHJvbHNNYW5hZ2VyLnVwZGF0ZSggZGVsdGEgKTtcclxuICAgICAgICB0b3VjaENvbnRyb2xzTWFuYWdlci51cGRhdGUoIGRlbHRhICk7XHJcbiAgICAgICAgcGh5c2ljc0VuZ2luZS51cGRhdGUoIGRlbHRhICk7XHJcbiAgICAgICAgcGFydGljbGVzTWFuYWdlci51cGRhdGUoIGRlbHRhICk7XHJcblxyXG4gICAgICAgIHN0YXRzLnVwZGF0ZSgpO1xyXG5cclxuICAgICAgICByZW5kZXJlci5yZW5kZXIoIHN0YWdlICk7XHJcblxyXG4gICAgfVxyXG5cclxufVxyXG5cclxuLy8gTWFudWFsbHkgdXBkYXRlIHBoeXNpY3MgaWYgcmVxdWVzdEFuaW1GcmFtZSBub3QgYXZhaWxhYmxlIChpZiB0YWIgaW5hY3RpdmUpXHJcbmZ1bmN0aW9uIGNoZWNrRGVsdGEoKSB7XHJcblxyXG4gICAgdmFyIHRlbXBUaW1lID0gbmV3IERhdGUoKSAtIHN0YXJ0VGltZTtcclxuICAgIC8vIGNvbnNvbGUubG9nKCd0ZW1wVGltZScsIHRlbXBUaW1lKTtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdsYXN0VGltZScsIGxhc3RUaW1lKTtcclxuXHJcbiAgICBpZiAoIHRlbXBUaW1lIC0gbGFzdFRpbWUgPj0gZ2FtZUNvbmZpZy5jaGVja0RlbHRhSW50ZXJ2YWxUaW1lICkge1xyXG5cclxuICAgICAgICBpZiAoICFpbmFjdGl2ZSApIHtcclxuICAgICAgICAgICAgaW5hY3RpdmUgPSB0cnVlO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyggJ3BsYXllciBpcyBpbmFjdGl2ZScgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfSBlbHNlIGlmICggaW5hY3RpdmUgKSB7XHJcblxyXG4gICAgICAgIGluYWN0aXZlID0gZmFsc2U7XHJcbiAgICAgICAgY29uc29sZS5sb2coICdwbGF5ZXIgY2FtZSBiYWNrJyApO1xyXG5cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gdXBkYXRlR2FtZVNpemUoKSB7XHJcblxyXG4gICAgZ2FtZUNvbmZpZy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xyXG4gICAgZ2FtZUNvbmZpZy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcblxyXG4gICAgcmVuZGVyZXIucmVzaXplKCBnYW1lQ29uZmlnLndpZHRoLCBnYW1lQ29uZmlnLmhlaWdodCApO1xyXG5cclxuICAgIHZhciByYXRpb1cgPSBnYW1lQ29uZmlnLndpZHRoIC8gZ2FtZUNvbmZpZy5iYXNlU2NlbmVXaWR0aDtcclxuICAgIHZhciByYXRpb0ggPSBnYW1lQ29uZmlnLmhlaWdodCAvIGdhbWVDb25maWcuYmFzZVNjZW5lSGVpZ2h0O1xyXG5cclxuICAgIGlmICggcmF0aW9XIDwgcmF0aW9IICkge1xyXG5cclxuICAgICAgICByYXRpbyA9IHJhdGlvVztcclxuICAgICAgICBkZWMueCA9IDA7XHJcbiAgICAgICAgZGVjLnkgPSAoIGdhbWVDb25maWcuaGVpZ2h0IC0gZ2FtZUNvbmZpZy5iYXNlU2NlbmVIZWlnaHQgKiByYXRpbyApIC8gMjtcclxuXHJcbiAgICB9IGVsc2Uge1xyXG5cclxuICAgICAgICByYXRpbyA9IHJhdGlvSDtcclxuICAgICAgICBkZWMueCA9ICggZ2FtZUNvbmZpZy53aWR0aCAtIGdhbWVDb25maWcuYmFzZVNjZW5lV2lkdGggKiByYXRpbyApIC8gMjtcclxuICAgICAgICBkZWMueSA9IDA7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHNjZW5lLnNjYWxlID0gbmV3IFBJWEkuUG9pbnQoIHJhdGlvLCByYXRpbyApO1xyXG4gICAgc2NlbmUueCA9IGRlYy54O1xyXG4gICAgc2NlbmUueSA9IGRlYy55O1xyXG5cclxuICAgIGJhY2tncm91bmQud2lkdGggPSBnYW1lQ29uZmlnLndpZHRoO1xyXG4gICAgYmFja2dyb3VuZC5oZWlnaHQgPSBnYW1lQ29uZmlnLmhlaWdodDtcclxuXHJcbiAgICBwaHlzaWNzRW5naW5lLnVwZGF0ZVNjZW5lUmVzaXplVmFsdWVzKCBkZWMsIHJhdGlvICk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRQaXhlbFNoYWRlclNpemUoIHNpemUgKSB7XHJcblxyXG4gICAgcGl4ZWxhdGVGaWx0ZXIuc2l6ZS54ID0gc2l6ZTtcclxuICAgIHBpeGVsYXRlRmlsdGVyLnNpemUueSA9IHNpemU7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRSR0JTcGxpdEZpbHRlclNpemUoIHRpbWUsIHNpemUgKSB7XHJcblxyXG4gICAgc2l6ZSA9IHNpemUgfHwgMjtcclxuICAgIHZhciB2YWx1ZSA9IHRpbWUgLyAxNjA7XHJcblxyXG4gICAgcmdiU3BsaXRGaWx0ZXIucmVkID0ge1xyXG4gICAgICAgIHg6IE1hdGguY29zKCB2YWx1ZSApICogc2l6ZSxcclxuICAgICAgICB5OiBNYXRoLnNpbiggdmFsdWUgKSAqIHNpemVcclxuICAgIH07XHJcblxyXG4gICAgcmdiU3BsaXRGaWx0ZXIuZ3JlZW4gPSB7XHJcbiAgICAgICAgeDogTWF0aC5jb3MoIHZhbHVlICsgTWF0aC5QSSAqIDIgLyAzICkgKiBzaXplLFxyXG4gICAgICAgIHk6IE1hdGguc2luKCB2YWx1ZSArIE1hdGguUEkgKiAyIC8gMyApICogc2l6ZVxyXG4gICAgfTtcclxuXHJcbiAgICByZ2JTcGxpdEZpbHRlci5ibHVlID0ge1xyXG4gICAgICAgIHg6IE1hdGguY29zKCB2YWx1ZSArIE1hdGguUEkgKiA0IC8gMyApICogc2l6ZSxcclxuICAgICAgICB5OiBNYXRoLnNpbiggdmFsdWUgKyBNYXRoLlBJICogNCAvIDMgKSAqIHNpemVcclxuICAgIH07XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBnbG9iYWxUb1NjZW5lTG9jYWxYKCB4ICkge1xyXG4gICAgcmV0dXJuICggeCAtIGRlYy54ICkgLyByYXRpbztcclxufVxyXG5cclxuZnVuY3Rpb24gZ2xvYmFsVG9TY2VuZUxvY2FsWSggeSApIHtcclxuICAgIHJldHVybiAoIHkgLSBkZWMueSApIC8gcmF0aW87XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNjZW5lTG9jYWxUb0dsb2JhbFgoIHggKSB7XHJcbiAgICByZXR1cm4gKCB4ICsgZGVjLnggKSAqIHJhdGlvO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzY2VuZUxvY2FsVG9HbG9iYWxZKCB5ICkge1xyXG4gICAgcmV0dXJuICggeSArIGRlYy55ICkgKiByYXRpbztcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0U2NlbmUoKSB7XHJcbiAgICByZXR1cm4gc2NlbmU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFN0YWdlKCkge1xyXG4gICAgcmV0dXJuIHN0YWdlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXREZWMoKSB7XHJcbiAgICByZXR1cm4gZGVjO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRSYXRpbygpIHtcclxuICAgIHJldHVybiByYXRpbztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBpbml0OiBpbml0LFxyXG4gICAgc2V0UGl4ZWxTaGFkZXJTaXplOiBzZXRQaXhlbFNoYWRlclNpemUsXHJcbiAgICBnZXRTY2VuZTogZ2V0U2NlbmUsXHJcbiAgICBnZXRTdGFnZTogZ2V0U3RhZ2UsXHJcbiAgICBnbG9iYWxUb1NjZW5lTG9jYWxYOiBnbG9iYWxUb1NjZW5lTG9jYWxYLFxyXG4gICAgZ2xvYmFsVG9TY2VuZUxvY2FsWTogZ2xvYmFsVG9TY2VuZUxvY2FsWSxcclxuICAgIHNjZW5lTG9jYWxUb0dsb2JhbFg6IHNjZW5lTG9jYWxUb0dsb2JhbFgsXHJcbiAgICBzY2VuZUxvY2FsVG9HbG9iYWxZOiBzY2VuZUxvY2FsVG9HbG9iYWxZLCAgICBcclxuICAgIGdldERlYzogZ2V0RGVjLFxyXG4gICAgZ2V0UmF0aW86IGdldFJhdGlvXHJcbn07XHJcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9zdGFnZU1hbmFnZXIuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5mdW5jdGlvbiBpbml0KCkge1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gb25TeW5jKCBkYXRhICkge1xyXG5cclxuICAgIGlmICggZGF0YS5ldmVudCA9PT0gJ2NyZWF0ZUJhbGwnICkge1xyXG5cclxuICAgICAgICBiYWxsc01hbmFnZXIuY3JlYXRlQmFsbCggZGF0YSApO1xyXG5cclxuICAgIH0gZWxzZSBpZiAoIGRhdGEuZXZlbnQgPT09ICd1cGRhdGVCYWxsJyApIHtcclxuXHJcbiAgICAgICAgYmFsbHNNYW5hZ2VyLnVwZGF0ZUJhbGwoIGRhdGEgKTtcclxuXHJcbiAgICAgICAgaWYgKCBkYXRhLmNvbGxpZGluZ0RpcmVjdGlvbiA9PT0gJ3QnICkge1xyXG5cclxuICAgICAgICAgICAgcGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyggYmFsbHNNYW5hZ2VyLmdldEJhbGwoIGRhdGEuSUQgKSwgOTAgKTtcclxuXHJcbiAgICAgICAgfSBlbHNlIGlmICggZGF0YS5jb2xsaWRpbmdEaXJlY3Rpb24gPT09ICdiJyApIHtcclxuXHJcbiAgICAgICAgICAgIHBhcnRpY2xlc01hbmFnZXIuY3JlYXRlQmFsbENvbGxpZGVQYXJ0aWNsZXMoIGJhbGxzTWFuYWdlci5nZXRCYWxsKCBkYXRhLklEICksIDI3MCApO1xyXG5cclxuICAgICAgICB9IGVsc2UgaWYgKCBkYXRhLmNvbGxpZGluZ0RpcmVjdGlvbiA9PT0gJ2wnICkge1xyXG5cclxuICAgICAgICAgICAgcGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyggYmFsbHNNYW5hZ2VyLmdldEJhbGwoIGRhdGEuSUQgKSwgMCApO1xyXG5cclxuICAgICAgICB9IGVsc2UgaWYgKCBkYXRhLmNvbGxpZGluZ0RpcmVjdGlvbiA9PT0gJ3InICkge1xyXG5cclxuICAgICAgICAgICAgcGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyggYmFsbHNNYW5hZ2VyLmdldEJhbGwoIGRhdGEuSUQgKSwgMTgwICk7XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9IGVsc2UgaWYgKCBkYXRhLmV2ZW50ID09PSAnc2V0QmFsbE91dCcgKSB7XHJcblxyXG4gICAgICAgIHZhciBvdXRCYWxsID0gYmFsbHNNYW5hZ2VyLmdldEJhbGwoIGRhdGEuSUQgKTtcclxuXHJcbiAgICAgICAgaWYgKCBvdXRCYWxsICkge1xyXG5cclxuICAgICAgICAgICAgYmFsbHNNYW5hZ2VyLnNldEJhbGxPdXQoIG91dEJhbGwgKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH0gZWxzZSBpZiAoIGRhdGEuZXZlbnQgPT09ICdkZXN0cm95QmFsbCcgKSB7XHJcblxyXG4gICAgICAgIHZhciBkZXN0cm95ZWRCYWxsID0gYmFsbHNNYW5hZ2VyLmdldEJhbGwoIGRhdGEuSUQgKTtcclxuXHJcbiAgICAgICAgaWYgKCBkZXN0cm95ZWRCYWxsICkge1xyXG5cclxuICAgICAgICAgICAgZGVzdHJveWVkQmFsbC54ID0gZGF0YS5wb3MueDtcclxuICAgICAgICAgICAgZGVzdHJveWVkQmFsbC55ID0gZGF0YS5wb3MueTtcclxuICAgICAgICAgICAgYmFsbHNNYW5hZ2VyLmRlc3Ryb3lCYWxsKCBkZXN0cm95ZWRCYWxsICk7XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9IGVsc2UgaWYgKCBkYXRhLmV2ZW50ID09PSAncmFja2V0TW92ZScgKSB7XHJcblxyXG4gICAgICAgIHJhY2tldHNNYW5hZ2VyLm1vdmVPcHBvbmVudFJhY2tldFRvKCBkYXRhLnksIGRhdGEuaW5zdGFudCApO1xyXG5cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gb25DcmVhdGVCYWxsKCBiYWxsICkge1xyXG5cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgIGV2ZW50OiAnY3JlYXRlQmFsbCcsXHJcbiAgICAgICAgSUQ6IGJhbGwuSUQsXHJcbiAgICAgICAgY29sb3I6IGJhbGwuY29sb3IsXHJcbiAgICAgICAgcG9zOiB7XHJcbiAgICAgICAgICAgIHg6IGJhbGwueCxcclxuICAgICAgICAgICAgeTogYmFsbC55XHJcbiAgICAgICAgfSxcclxuICAgICAgICB2ZWw6IHtcclxuICAgICAgICAgICAgeDogYmFsbC52ZWwueCxcclxuICAgICAgICAgICAgeTogYmFsbC52ZWwueSxcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgc29ja2V0c01hbmFnZXIuZW1pdCggJ3N5bmMnLCBkYXRhICk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBvblVwZGF0ZUJhbGwoIGJhbGwsIGNvbGxpZGluZ0RpcmVjdGlvbiApIHtcclxuXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICBldmVudDogJ3VwZGF0ZUJhbGwnLFxyXG4gICAgICAgIElEOiBiYWxsLklELFxyXG4gICAgICAgIHBvczoge1xyXG4gICAgICAgICAgICB4OiBiYWxsLngsXHJcbiAgICAgICAgICAgIHk6IGJhbGwueVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdmVsOiB7XHJcbiAgICAgICAgICAgIHg6IGJhbGwudmVsLngsXHJcbiAgICAgICAgICAgIHk6IGJhbGwudmVsLnksXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb2xsaWRpbmdEaXJlY3Rpb246IGNvbGxpZGluZ0RpcmVjdGlvblxyXG4gICAgfTtcclxuICAgIHNvY2tldHNNYW5hZ2VyLmVtaXQoICdzeW5jJywgZGF0YSApO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gb25CYWxsT3V0KCBiYWxsICkge1xyXG5cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgIGV2ZW50OiAnc2V0QmFsbE91dCcsXHJcbiAgICAgICAgSUQ6IGJhbGwuSURcclxuICAgIH07XHJcbiAgICBzb2NrZXRzTWFuYWdlci5lbWl0KCAnc3luYycsIGRhdGEgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQmFsbERlc3Ryb3koIGJhbGwgKSB7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgZXZlbnQ6ICdkZXN0cm95QmFsbCcsXHJcbiAgICAgICAgSUQ6IGJhbGwuSUQsXHJcbiAgICAgICAgcG9zOiB7XHJcbiAgICAgICAgICAgIHg6IGJhbGwueCxcclxuICAgICAgICAgICAgeTogYmFsbC55XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHNvY2tldHNNYW5hZ2VyLmVtaXQoICdzeW5jJywgZGF0YSApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvblJhY2tldFNldE1vdmluZ1RvWSggeSwgaW5zdGFudCApIHtcclxuXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICBldmVudDogJ3JhY2tldE1vdmUnLFxyXG4gICAgICAgIHk6IHksXHJcbiAgICAgICAgaW5zdGFudDogaW5zdGFudFxyXG4gICAgfTtcclxuICAgIHNvY2tldHNNYW5hZ2VyLmVtaXQoICdzeW5jJywgZGF0YSApO1xyXG4gICAgXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgaW5pdDogaW5pdCxcclxuICAgIG9uU3luYzogb25TeW5jLFxyXG4gICAgb25DcmVhdGVCYWxsOiBvbkNyZWF0ZUJhbGwsXHJcbiAgICBvblVwZGF0ZUJhbGw6IG9uVXBkYXRlQmFsbCxcclxuICAgIG9uQmFsbE91dDogb25CYWxsT3V0LFxyXG4gICAgb25CYWxsRGVzdHJveTogb25CYWxsRGVzdHJveSxcclxuICAgIG9uUmFja2V0U2V0TW92aW5nVG9ZOiBvblJhY2tldFNldE1vdmluZ1RvWVxyXG59O1xyXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiaHRaa3g0XCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc3luY01hbmFnZXIuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgdG91Y2ggPSAtMSxcclxuICAgIHJlc2V0VGltZW91dDtcclxuXHJcblxyXG5mdW5jdGlvbiBpbml0KCkge1xyXG5cclxuICAgICQoIGRvY3VtZW50ICkub24oICd0b3VjaHN0YXJ0Jywgb25Ub3VjaFN0YXJ0ICk7XHJcbiAgICAkKCBkb2N1bWVudCApLm9uKCAndG91Y2htb3ZlJywgb25Ub3VjaE1vdmUgKTtcclxuICAgICQoIGRvY3VtZW50ICkub24oICd0b3VjaGVuZCcsIG9uVG91Y2hFbmQgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZSggZGVsdGEgKSB7XHJcblxyXG4gICAgXHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uVG91Y2hTdGFydCggZXZlbnQgKSB7XHJcblxyXG4gICAgY2xlYXJUaW1lb3V0KHJlc2V0VGltZW91dCk7XHJcbiAgICB0b3VjaCA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlc1swXS5jbGllbnRZO1xyXG5cclxuICAgIGNvbnNvbGUubG9nKCd0b3VjaHN0YXJ0Jyk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBvblRvdWNoTW92ZSggZXZlbnQgKSB7XHJcblxyXG4gICAgdmFyIGRpc3RhbmNlID0gZ2FtZUNvbmZpZy5oZWlnaHQgLyAoZXZlbnQub3JpZ2luYWxFdmVudC5jaGFuZ2VkVG91Y2hlc1sgMCBdLmNsaWVudFkgLSB0b3VjaCk7XHJcbiAgICBjb25zb2xlLmxvZygndG91Y2htb3ZlJywgZGlzdGFuY2UpO1xyXG5cclxuICAgIHJhY2tldHNNYW5hZ2VyLm1vdmVQbGF5ZXJSYWNrZXRUbyggZ2FtZUNvbmZpZy5iYXNlU2NlbmVIZWlnaHQgKiAwLjUgKyBnYW1lQ29uZmlnLmJhc2VTY2VuZUhlaWdodCAqIDIgLyBkaXN0YW5jZSk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBvblRvdWNoRW5kKCBldmVudCApIHtcclxuXHJcbiAgICB0b3VjaCA9IHJhY2tldHNNYW5hZ2VyLmdldFBsYXllclJhY2tldE1vdmluZ1RvWTtcclxuXHJcbiAgICByZXNldFRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJhY2tldHNNYW5hZ2VyLm1vdmVQbGF5ZXJSYWNrZXRUbyggZ2FtZUNvbmZpZy5iYXNlU2NlbmVIZWlnaHQgKiAwLjUgKTtcclxuICAgIH0sIDE1MCk7XHJcblxyXG59XHJcblxyXG5cclxuLy8gZnVuY3Rpb24gdXBkYXRlKCBkZWx0YSApIHtcclxuXHJcbi8vICAgICBpZiAoIHRvdWNoU3RhdGVzLmxlZnQgJiYgdG91Y2hTdGF0ZXMucmlnaHQgfHwgIXRvdWNoU3RhdGVzLmxlZnQgJiYgIXRvdWNoU3RhdGVzLnJpZ2h0ICkge1xyXG5cclxuLy8gICAgICAgICByYWNrZXRzTWFuYWdlci5tb3ZlUGxheWVyUmFja2V0VG8oIGdhbWVDb25maWcuYmFzZVNjZW5lSGVpZ2h0ICogMC41ICk7XHJcblxyXG4vLyAgICAgfSBlbHNlIGlmICggdG91Y2hTdGF0ZXMubGVmdCApIHtcclxuXHJcbi8vICAgICAgICAgcmFja2V0c01hbmFnZXIubW92ZVBsYXllclJhY2tldFRvKCBnYW1lQ29uZmlnLmJhc2VTY2VuZUhlaWdodCApO1xyXG5cclxuLy8gICAgIH0gZWxzZSBpZiAoIHRvdWNoU3RhdGVzLnJpZ2h0ICkge1xyXG5cclxuLy8gICAgICAgICByYWNrZXRzTWFuYWdlci5tb3ZlUGxheWVyUmFja2V0VG8oIDAgKTtcclxuXHJcbi8vICAgICB9XHJcbi8vIH1cclxuXHJcbi8vIGZ1bmN0aW9uIG9uVG91Y2hTdGFydCggZXZlbnQgKSB7XHJcblxyXG4vLyAgICAgZm9yICggdmFyIGkgPSBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0gKSB7XHJcblxyXG4vLyAgICAgICAgIHZhciBzaWRlID0gZXZlbnQub3JpZ2luYWxFdmVudC50b3VjaGVzWyBpIF0uY2xpZW50WCA8IGdhbWVDb25maWcud2lkdGggLyAyID8gJ2xlZnQnIDogJ3JpZ2h0JztcclxuLy8gICAgICAgICB0b3VjaFN0YXRlc1sgc2lkZSBdID0gdHJ1ZTtcclxuLy8gICAgICAgICAvLyBjb25zb2xlLmxvZyggc2lkZSwgdG91Y2hTdGF0ZXNbIHNpZGUgXSwgZXZlbnQub3JpZ2luYWxFdmVudC50b3VjaGVzWyBpIF0uY2xpZW50WCwgZ2FtZUNvbmZpZy53aWR0aCApO1xyXG5cclxuLy8gICAgIH1cclxuXHJcbi8vICAgICB1cGRhdGUoKTtcclxuXHJcbi8vIH1cclxuXHJcbi8vIGZ1bmN0aW9uIG9uVG91Y2hFbmQoIGV2ZW50ICkge1xyXG5cclxuLy8gICAgIHZhciBzaWRlID0gZXZlbnQub3JpZ2luYWxFdmVudC5jaGFuZ2VkVG91Y2hlc1sgMCBdLmNsaWVudFggPCBnYW1lQ29uZmlnLndpZHRoIC8gMiA/ICdsZWZ0JyA6ICdyaWdodCc7XHJcbi8vICAgICB0b3VjaFN0YXRlc1sgc2lkZSBdID0gZmFsc2U7XHJcbi8vICAgICB1cGRhdGUoKTtcclxuXHJcbi8vIH1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgaW5pdDogaW5pdCxcclxuICAgIHVwZGF0ZTogdXBkYXRlXHJcbn07XHJcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJodFpreDRcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi90b3VjaENvbnRyb2xzTWFuYWdlci5qc1wiLFwiL1wiKSJdfQ==
