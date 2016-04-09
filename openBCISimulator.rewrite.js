const EventEmitter = require('events').EventEmitter;
const util = require('utils');
const stream = require('stream');
const readable = stream.Readable;
const openBCISample = require('./openBCISample');
const k = openBCISample.k;
const now = require('performance-now');

function openBCISimulatorFactory() {
    var factory = this;

    const _options = {
        samplerate: 250,
        daisy: false,
        verbose: false,
    };


    function OpenBCISimulator(portName, options) {
        options = (typeof options !== 'function') && options || {};

        var opts = {};

        stream.Stream.call(this);

        /*Configuring Options */
        opts.sampleRate = options.sampleRate || options.samplerate || _options.samplerate;
        opts.daisy = options.daisy || _options.daisy;
        opts.verbose = options.verbose || _options.verbose;
        opts.intervalInMS = 1000/_options.samplerate ||  1000/_options.sampleRate;

        this.options = opts;
        // Bools
        this.connected = false;
        // Buffers
        this.buffer = new Buffer(500);
        // Numbers
        this.sampleNumber = -1; // So the first sample is 0
        // Objects
        this.time = {
            current: 0,
            start: now(),
            loop: null,
            ntp0: 0,
            ntp1: 0,
            ntp2: 0,
            ntp3: 0
        };
        this.open(portName);
    }
    util.inherits(OpenBCISimulator, stream.Stream);

    OpenBCISimulator.prototype.open = function(portName) {
        console.log('Simulator started at time: ' + this.time.start);
        console.log('Time board has been running: ' + (now() - this.time.start));
        // Strings
        this.portName = portName || k.OBCISimulatorPortName;

        this.time.start = now();

        if (portName === k.OBCSimulatorPortName) {
            this.emit('open');
            this.conencted = true;
        } else {
            this.emit('error', new Error('Simulator not starting'));
        }
    };

    OpenBCISimulator.prototype._flush = function(cb) {
       this.buffer.fill(0);
    };

    OpenBCISimulator.prototype._write = function(chunk,encoding, cb) {
        var buffer = (Buffer.isBuffer(chunk)) ?
            chunk :  // already is Buffer use it
            new Buffer(chunk, enc);
    };

    OpenBCISimulator.prototype._read = function(size) {
        if(this.intervalInMS < 2) this.intervalInMS = 2;

        var generateSample = openBCISample.randomSample(k.OBCINumberOfChannelsDefault, k.OBCISampleRate250);

        var getNewPocket = sampleNumber => openBCISample.convertSampleToPocket(generateSample(sampleNumber));

        setInterval(() => {
            this.push(getNewPacket(this.sampleNumber));
            this.sampleNumber++;
        }, intervalInMS);

    };

    OpenBCISimulator.prototype.close = function(callback) {
        if(this.connected) {
            this.connected = false;
            this.emit('close');
        }
        callback();
    }




}