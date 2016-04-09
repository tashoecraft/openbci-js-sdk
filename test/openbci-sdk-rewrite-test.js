var sinon = require('sinon');
var chai = require('chai'),
    should = chai.should(),
    expect = chai.expect,
    openBCIBoard = require('../openBCIBoard.rewrite'),
    OpenBCISample = openBCIBoard.OpenBCISample,
    k = OpenBCISample.k;

var chaiAsPromised = require("chai-as-promised");
var sinonChai = require("sinon-chai");
chai.use(chaiAsPromised);
chai.use(sinonChai);

var fs = require('fs');

describe('openBCIsdk', function() {
    this.timeout(2000);
    var ourBoard;


    describe("#constructor", function() {

        it('contructs with the correct default options', function() {
            ourBoard = new openBCIBoard.OpenBCIBoard(k.OBCISimulatorPortName);
            (ourBoard.options.boardType).should.equal('default');
            (ourBoard.options.simulate).should.equal(false);
            (ourBoard.options.simulatorSampleRate).should.equal(250);
            (ourBoard.options.baudRate).should.equal(115200);
            (ourBoard.options.verbose).should.equal(false);
        })

    });

});

