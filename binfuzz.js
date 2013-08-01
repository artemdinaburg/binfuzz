"use strict";
/*
 *  Binfuzz.js is licensed under the MIT License: 
 *  Copyright (c) 2013 Artem Dinaburg
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a
 *  copy
 *  of this software and associated documentation files (the "Software"), to
 *  deal
 *  in the Software without restriction, including without limitation the
 *  rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *  FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/*
* memoize code based on:
* memoize.js
* by @philogb and @addyosmani
* with further optimizations by @mathias
* and @DmitryBaranovsk
* perf tests: http://bit.ly/q3zpG3
* Released under an MIT license.
*/

var MEMORIES = {};
function memoize( fn ) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        var thisname = this.parent ? this.parent.name + this.name : this.name ;
        thisname = thisname.replace(/\[\d+\]/g, '');
        args.unshift(thisname);
        var hash = "", i = args.length;

        var currentArg = null;
        while (i--) {
            currentArg = args[i];
            hash += (currentArg === Object(currentArg)) ?
                JSON.stringify(currentArg) : currentArg;
            //fn.memoize || (fn.memoize = {});
            MEMORIES[fn] || (MEMORIES[fn] = {})
        }
        args.shift();
        var memret = (hash in MEMORIES[fn]) ? MEMORIES[fn][hash] : MEMORIES[fn][hash] = fn.apply(this, args)
            return memret;
    };
} 

// binary parser used from
//http://jsfromhell.com/classes/binary-parser
var bp = new BinaryParser(false, false);

/////////////////////
// Create Object.create for IE
// taken from: http://javascript.crockford.com/prototypal.html
/////////////////////
if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        function F() {}
        F.prototype = o;
        return new F();
    };
}

///////////////////
// Fix for no console.log in IE
// taken from:    
// http://stackoverflow.com/questions/690251/what-happened-to-console-log-in-ie8
///////////////////
var alertFallback = false;
if (typeof console === "undefined" || typeof console.log === "undefined") {
    console = {};
    if (alertFallback) {
        console.log = function(msg) {
            alert(msg);
        };
    } else {
        console.log = function() {};
    }
}

function seedRandomString() {
		var ALLCHARS = new Array();
		var tmparray  = new Array();
		Math.seedrandom("icofuzz");

		for(var i = 0; i < 256; i++) {
				ALLCHARS.push(String.fromCharCode(i));
		}

		for(var i = 2048; i > 0; i--) {
				tmparray.push(ALLCHARS[Math.floor((Math.random() * 256))]);
		}
		return tmparray.join("");
}

var RandomStr = seedRandomString();

function makeRandomString(desiredlen) {
		var rands = new Array();
		var l = RandomStr.length;
		var rem = desiredlen % l;
		var count = Math.floor(desiredlen / l);
		for(var i = count; i > 0; i-=l) {
				rands.push(RandomStr);
		}
		rands.push(RandomStr.substr(rem));

		return rands.join("");
}

//////////////////////////////
// DataItem = base class of all 
// elements in fuzz tree
//////////////////////////////
function DataItem (kwargs) {
    if (kwargs) {
        this.root = kwargs['root'];
        this.name = kwargs['name'];
        this.parent = kwargs['parent'];
    } else {
        this.name = 'undefined';
    }
};

DataItem.prototype.Size = function () {
    throw "please define the Size method of: " + this;
};

DataItem.prototype.Value = function () {
    throw "please define the Value method of: " + this;
};

DataItem.prototype.NativeValue = function () {
    throw "please define the NativeValue method of: " + this;
};

DataItem.prototype.Combos = function () {
    throw "please define the Combos method of: " + this;
};

DataItem.prototype.Distribute = function(combo, seed) {
		// erase cached icon data
		MEMORIES = {};
		this.fuzzcombo = combo;
		this.seed = seed;
};

DataItem.prototype.FetchItem = function(valuename) {
    if(this.name == valuename) {
        return this;
    } else {
        throw "I am: " + this.name + ", want to fetch: " + valuename;
    }
};

DataItem.prototype.GetOffset = function(valuename) {
    if(this.name == valuename) {
        return 0;
    } else {
        throw "I am: " + this.name + ", want offset of: " + valuename;
    }
};

DataItem.prototype.HelpGC = function () {
		delete this.root;
		delete this.name;
		delete this.parent;
		this.root = undefined;
		this.name = undefined;
		this.parent = undefined;
		MEMORIES = {};
};


////////////////////////////////////
// Container - Used for representing
// structures
////////////////////////////////////

function Container(kwargs) {
    DataItem.call(this, kwargs);
    // this element's children
    this.children = new Array();
    this._children = new Object();
};

Container.prototype = new DataItem({});
Container.prototype.constructor = Container;

Container.prototype.Size = function() { 
    // default implementation: add the sizes
    // of all children
    var subsize = 0;

    for(var child in this.children) {
        subsize += this.children[child].Size();
    }

    return subsize;
};

Container.prototype.NativeValue = function() {
    throw "NativeValue is not defined for Container types";
};

Container.prototype.Value = memoize(function() {
    // default implementation:
    // return value of all children
		var values = new Array();

    //console.log("Container: " + this.name + " has " + this.children.length + " children");
    for(var child in this.children) {
        //console.log("Container: " + this.name + ", child val:" + child);
        var tempval = this.children[child].Value();
        if(tempval === undefined) {
            throw "got undefined value!"
        }
        //console.log("Container: " + this.name + " added value of: " + this.children[child].name + ", Value: " + window.btoa(tempval) + ", len: " + tempval.length);
				values.push(tempval);
    }

    return values.join("");
});

Container.prototype.Distribute = function(combo, seed) {
    // first, sanity check;
    var numcombos = this.Combos();
    if(combo > numcombos)
        throw "Wanted combo " + combo + " but only have: " + numcombos;

		// erase cached icon data
		MEMORIES = {};

    // TODO: figure out how many combos this
    // container will eat with its fuzzing
    for(var child in this.children) {
        var childObj = this.children[child];
        var ccombos = childObj.Combos();

        var rem = combo % ccombos;
        childObj.Distribute(rem, seed);

        combo -= rem;
        combo /= ccombos;
    }
};

Container.prototype.Combos = function () {
    // return combinatorial value of all combos

    var combos = 1;

    for(var child in this.children) {
        var childcombos = this.children[child].Combos();
        //console.log("Child " + this.children[child].name + " has: " + childcombos + " combos\n"); 
        combos *= childcombos;
    }

    // TODO: add child count manipulation combos

    return combos;
};

Container.prototype.addChild = function(newchild) {

    if (! (newchild instanceof DataItem ) ) {
        throw "Children must be a subclass of DataItem"
    }

    newchild.parent = this;
    this.children.push(newchild);
    this._children[newchild.name] = newchild;
};

Container.prototype.getChild = function(cname) {
    for(var cn in this._children) {
        if(cn == cname) {
            return this._children[cn];
        }
    }

    throw "No child named: " + cname + " of Container: " + this.name;
};

Container.prototype.FetchItem = function(valuename) {
    if(valuename == this.name) {
        return this;
    }

    var parts = valuename.split(".");

    if (parts[0] != this.name) {
        // sanity check fail
        throw "Container Sanity check failed. I am : " + this.name + " but should have been: " + parts[0];
    }

    // check for array children
    var childname = parts[1];
    var isarray = /\[(\d+)\]$/;

    if(isarray.test(childname) === true) {
        childname = childname.replace(isarray, "");
    } else {
    }

    var child = this.getChild(childname);
    var childpath = parts.slice(1).join(".");

    return child.FetchItem(childpath); 

};

Container.prototype.offsetOf = function(childname) {
    var offset = 0;

    for(var child in this.children) {
        var co = this.children[child];
        if(co.name == childname)
            break;

        offset += co.Size();
    }
    
    return offset;
};

Container.prototype.GetOffset = function(valuename) { 

    // do we want offset of container?
    if (this.name == valuename) {
        return 0;
    }
    var parts = valuename.split(".");

    if (parts[0] != this.name) {
        // sanity check fail
        throw "Container Sanity check failed. I am : " + this.name + " but should have been: " + parts[0];
    }

    // check for array children
    var childname = parts[1];
    var isarray = /\[(\d+)\]$/;

    if(isarray.test(childname) == true) {
        childname = childname.replace(isarray, "");
    } else {
    }

    var child = this.getChild(childname);
    var offset = this.offsetOf(childname);
    var childpath = parts.slice(1).join(".");

    return offset + child.GetOffset(childpath); 
};

Container.prototype.HelpGC = function() { 
    for(var child in this.children) {
        this.children[child].HelpGC();
    }

    DataItem.prototype.HelpGC.call(this);
    // this element's children
    delete this.children;
    delete this._children;
		this.children = undefined;
    this._children = undefined;
};

function ArrayContainer(kwargs) {
    DataItem.call(this, kwargs);
    // this element's children
    this.children = new Array();
    this._children = new Object();
    this.count = kwargs['count']; 
    this.indexer = kwargs['indexer'];
    this._arraypat = new RegExp(this.name + "\\[(\\d+)\\]$");
    this._arraychildren = new Array();
    this.havearraychildren = false;
};

ArrayContainer.prototype = new Container({});
ArrayContainer.prototype.constructor = ArrayContainer;

ArrayContainer.prototype.Size = function() {
    
    // default implementation: add the sizes
    // of all children
    var subsize = 0;
    
    for(var child in this.children) {
        subsize += this.children[child].Size();
    }

    return subsize * this.root.FetchItem(this.count).NativeValue();
};

ArrayContainer.prototype.NativeValue = function() {
    throw "NativeValue is not defined for ArrayContainer types";
};

ArrayContainer.prototype.Distribute = function(combo, seed) {
		// erase cached icon data
		MEMORIES = {};
    Container.prototype.Distribute.call(this,combo, seed);
    this.havearraychildren = false;
};

ArrayContainer.prototype.getArrayChild = function(index, childname) {

    if(this.havearraychildren === false) {
        throw "Asked to get arraychild: " + childname + " but have no arraychildren";
    }

    var childEntries = this.arraychildren[index];
    var thechild = childEntries.getChild(childname);

    return thechild;
};

ArrayContainer.prototype.createArrayChildren = function() {

    // re-set ourselves
    this.arraychildren = new Array();

    // how many children do we have this iteration?
    var numchildren = this.root.FetchItem(this.count).NativeValue();

    for(var i = 0; i < numchildren; i++) {
        // TODO: may need to implement deepcopy?
        var ccont = new Container(
            {'name': this.name + "[" + i.toString() + "]",
             'root': this.root} 
        );

        for (var child in this.children) {
            var cref = Object.create(this.children[child]);
            var targ = cref.target;
            // replace any %n, etc, in targets with the array index of this
            // element
            if (typeof(targ) == "string") {
                cref.target = targ.replace(this.indexer, i);
                //console.log("FIXING TARGET to: " + cref.target);
            }
            cref.parent = ccont;
            ccont.addChild(cref);
        }

        this.arraychildren.push(ccont);
    }

    this.havearraychildren = true;
};

ArrayContainer.prototype.Value = function() {
    // default implementation:
    // return value of all children
    var values = new Array();

    if(this.havearraychildren == false) {
        this.createArrayChildren();
    }

    for(var child in this.arraychildren) {
        var cval = this.arraychildren[child].Value();
        //console.log("Child " + this.arraychildren[child].name + ", len(cval) is: " + cval.length);
        values.push(cval);
    }

    //console.log("Array " + this.name + " len(value) = " + myvalue.length);
    return values.join("");
};

ArrayContainer.prototype.FetchItem = function(valuename) {

    //console.log("Array Container (" + this.name + ") Fetch Item: " + valuename);
    // do we want the array itself?
    if (this.name == valuename) {
        //console.log("short circuiting: " + valuename);
        return this;
    }

    if(this._arraypat.test(valuename) == true) {
        //console.log("short circuiting array: " + valuename);
        return this;
    }

    var parts = valuename.split(".");
    // what array element is this requesting?
    var matcharr = this._arraypat.exec(parts[0]);

    if (matcharr == null) {
        // sanity check fail
        throw "ArrayContainer Sanity check failed. I am : " + this.name + " but should have been: " + parts[0] + "[%n]";
    }

    var childIndex = parseInt(matcharr[1]);

    var child = this.getArrayChild(childIndex, parts[1]);
    var childname = parts.slice(1).join(".");

    return child.FetchItem(childname);
        
};

ArrayContainer.prototype.getArrayOffset = function(index, name) {
    var arrsize = 0;
    var suboffset = 0;
    
    // calculate size of one single array element
    // and while at it, get how far into it
    // this element is
    for(var child in this.children) {
        // get offset of this child
        if (this.children[child].name == name)
            suboffset = subsize;

        arrsize += this._children[child].Size();
    }

    return (index * arrsize) + suboffset;
};

ArrayContainer.prototype.GetOffset = function(valuename) { 

    // do we want offset of whole array?
    if (this.name == valuename) {
        return 0;
    }

    if(this._arraypat.test(valuename) === true) {
        return 0;
    }

    var parts = valuename.split(".");
    // what array element is this requesting?
    var matcharr = this._arraypat.exec(parts[0]);

    if (matcharr === null) {
        // sanity check fail
        throw "ArrayContainer Sanity check failed. I am : " + this.name + " but should have been: " + parts[0] + "[%n]";
    }

    var childIndex = parseInt(matcharr[1]);

    // get offset of child in array
    var offset = this.getArrayOffset(childIndex, parts[1]);
    // get ref to child
    var child = this.getArrayChild(childIndex, parts[1]);

    var childname = parts.slice(1).join(".");

    // this child could be a Container, proceed more getoffsetting
    return offset + child.GetOffset(childname);

};

ArrayContainer.prototype.HelpGC = function() { 
    for(var child in this.children) {
        this.children[child].HelpGC();
    }

    DataItem.prototype.HelpGC.call(this);
    // this element's children
    delete this.children;
    delete this._children;
		this.children = undefined;
    this._children = undefined;
    delete this._arraypat;
    this._arraypat = undefined;
    delete this._arraychildren;
    this._arraychildren = undefined;
    this.count = undefined;
    this.indexer = undefined;
};


////////////////////////////////////
// Int - Used for representing
// integers
////////////////////////////////////
function Int(kwargs) {
    DataItem.call(this, kwargs);
    this.bytesize = kwargs['bytesize'];
    this.signed = kwargs['signed'];
    this.constant = kwargs['constant']; // constant value, do not fuzz
    this.defval = kwargs['default']; // non-fuzzed value
    this.values = kwargs['values']; // custom fuzzing values

    if(this.values != undefined) {
        // custom values defined; don't worry about it
        //console.log(this.name + ": has pre-defined values: " + this.values);
        return;
    }

    // signed or unsigned currently ingored
    if(this.constant != undefined)
    {
        this.values = [this.constant];
    } else {
        switch(this.bytesize) {
            case 1:
                //console.log("Set values for: " + this.name);
                this.values = [0, 1, 17, 33, 65, 0x55, 127, 128, 254, 255];
                break;
            case 2:
                //console.log("Set values for: " + this.name);
                this.values =  [0, 1, 0x00FF, 0xFF00, 0x7FFF, 0x8000, 0xFFFF, 0xFFFE];
                break;
            case 4:
                //console.log("Set values for: " + this.name);
                this.values = [0x00000000, 0x00000001, 0x00000002, 0xFF000000, 0x7FFF0000, 0xAAAAAAAA,
                    0x80000000, 0x80000001, 0x80000002, 0x7FFFFFFF, 0x7FFFFFFE, 0x7FFFFFFD,
                    0xFFFF0000, 0xFFFE0000, 0x80010000, 0x80020000, 0xFFFFFFFF, 0xFFFFFFFE,
                    0xFFFFFFFD, 0x0000FFFF, 0x0000FFFE, 0x00010000, 0x00010001, 0x00FFFF00,
                    0x7FFE0000, 0x0000FF00, 0x000000FF, 0x00007FFF, 0x00007FFE, 0x00008000,
                    0x00008001, 0x55555555];
                break;
            default:
                console.log("FAIL values for: " + this.name);
                this.values = [];
                throw "Unknown integer size: " + this.bytesize;
        }

        // if there is a default value, 
        // add it to front of values array;
        if(this.defval != undefined) {
            //console.log(this.name + ": has default value: " + this.defval);
            this.values.splice(0,0,this.defval);
            //console.log(this.name + ": values are now: " + this.values);
        }
    }
    
};

Int.prototype = new DataItem({});
Int.prototype.constructor = Int;

Int.prototype.Size = function() {
    // ints always have the same size
    return this.bytesize;
};

Int.prototype.NativeValue = function() {
    // return value from list.
    return this.values[this.fuzzcombo];
};

Int.prototype.stringify = function(number) {
    var tostrfn = undefined;
    switch(this.bytesize)
    {
        case 1:
            tostrfn = bp.fromSmall;
            break;
        case 2:
            tostrfn = bp.fromWord;
            break;
        case 4:
            tostrfn = bp.fromDWord;
            break;
    }

    var strval = tostrfn.call(bp, number);
    return strval;
};

Int.prototype.Value = function() {
    // return value from list.
    var nval = this.NativeValue();
    var sval = this.stringify(nval);
    //console.log("Int value: " + sval + ", len=" + sval.length + ", nval: " + nval);
    if(sval === undefined) {
        throw "attempting to return undefined value";
    }
    return sval;
};

Int.prototype.Combos = function() {
    return this.values.length;
};

Int.prototype.HelpGC = function() {
		DataItem.prototype.HelpGC.call(this);
    this.values = undefined;
}


//////////////////////
// Shortcut for 4 byte integers
//////////////////////
function UInt32(kwargs) {
    kwargs['bytesize'] = 4;
    kwargs['signed'] = false;
    Int.call(this, kwargs);
};

UInt32.prototype = new Int({'bytesize': 4});
UInt32.prototype.constructor = UInt32;

function Int32(kwargs) {
    kwargs['bytesize'] = 4;
    kwargs['signed'] = true;
    Int.call(this, kwargs);
};

Int32.prototype = new Int({'bytesize': 4});
Int32.prototype.constructor = Int32;


function UInt16(kwargs) {
    kwargs['bytesize'] = 2;
    kwargs['signed'] = false;
    Int.call(this, kwargs);
};

UInt16.prototype = new Int({'bytesize': 2});
UInt16.prototype.constructor = UInt16;

function Int16(kwargs) {
    kwargs['bytesize'] = 2;
    kwargs['signed'] = true;
    Int.call(this, kwargs);
};

Int16.prototype = new Int({'bytesize': 2});
Int16.prototype.constructor = Int16;

function UInt8(kwargs) {
    kwargs['bytesize'] = 1;
    kwargs['signed'] = false;
    Int.call(this, kwargs);
};

UInt8.prototype = new Int({'bytesize': 1});
UInt8.prototype.constructor = UInt8;

function Int8(kwargs) {
    kwargs['bytesize'] = 1;
    kwargs['signed'] = true;
    Int.call(this, kwargs);
};

Int8.prototype = new Int({'bytesize': 1});
Int8.prototype.constructor = Int8;
///////////////////
// IntSize respresent an size of something
// that will fit into an integer
///////////////////

function IntSize(kwargs) {
		Int.call(this, kwargs); 
		//console.log("Created Int for: " + this.name);
		this.target = kwargs['target'];
		this.nofuzz = kwargs['nofuzz'];
		this.calcfunc = kwargs['calcfunc'];
		this.modifiers = kwargs['modifiers'];
		if(this.modifiers === undefined) {
				switch(this.bytesize) {
						case 4:
								this.modifiers = [1, -1, 2, -2, 0x100, 0xFF00, 0x1000, 0xF000, 0x7FFFFFFF];
								break;
						case 2:
								this.modifiers = [1, -1, 2, -2, 0x100, 0xFF00, 0x1000, 0xF000, 0x7FFF];
								break;
						case 1: 
						default:
								this.modifiers = [1, -1, 2, -2, 0xFF];
								break;
				}
		} 
};

IntSize.prototype = new Int({'bytesize': 4});
IntSize.prototype.constructor = IntSize;

IntSize.prototype.calcSize = function() {
		if(this.calcfunc) {
				return this.calcfunc(this.target, this.fuzzcombo);
		} else {
				if (typeof(this.target) == "string") {
						// dynamically resolve target
						return this.root.FetchItem(this.target).Size();
				} else {
						// we have a static reference to target
						return this.target.Size();
				}
		}
}

IntSize.prototype.NativeValue = function() {
    if (this.nofuzz || this.fuzzcombo === 0) {
				return this.calcSize();
    } else {
				var comb = this.fuzzcombo - 1;
				if(comb < this.modifiers.length) {
						return this.modifiers[comb] + this.calcSize();
				}
        // if we are fuzzing sizes
        // combo = 0 count target, else
        // return fuzzed integer
        return this.values[this.fuzzcombo-1-this.modifiers.length];
    }
};

IntSize.prototype.Value = function() {
        // if we are not fuzzing sizes
        // then count our target
    var myvalue = this.stringify(this.NativeValue());

    if(myvalue === undefined) {
        throw "attempting to return undefined value";
    }
    return myvalue;
};

IntSize.prototype.Combos = function() {
    if (this.nofuzz) {
        return 1;
    } else {
        return 1 + this.modifiers.length + Int.prototype.Combos.call(this);
    }

};

IntSize.prototype.HelpGC = function() {
		Int.prototype.HelpGC.call(this);
		delete this.target;
		this.target = undefined;
    delete this.calcfunc;
    this.calcfunc = undefined;
};


///////////////////////////////
// IntOffset represents the
// distance another item is
// from a certain point
///////////////////////////////
function IntOffset(kwargs) {
    Int.call(this, kwargs); 
    //console.log("Created IntOffset for: " + this.name);
    this.target = kwargs['target'];
    this.nofuzz = kwargs['nofuzz'];
    this.calcfunc = kwargs['calcfunc'];
		this.modifiers = kwargs['modifiers'];
		if(this.modifiers === undefined) {
				switch(this.bytesize) {
						case 4:
								this.modifiers = [1, -1, 2, -2, 0x100, 0xFF00, 0x1000, 0xF000, 0x7FFFFFFF];
								break;
						case 2:
								this.modifiers = [1, -1, 2, -2, 0x100, 0xFF00, 0x1000, 0xF000, 0x7FFF];
								break;
						case 1: 
						default:
								this.modifiers = [1, -1, 2, -2, 0xFF];
								break;
				}
		} 
};

IntOffset.prototype = new Int({'bytesize': 4});
IntOffset.prototype.constructor = IntOffset;

IntOffset.prototype.calcOffset = function() {
		if(this.calcfunc) {
				return this.calcfunc(this.target, this.fuzzcombo);
		} else {
				if (typeof(this.target) == "string") {
						// dynamically resolve target
						return this.root.GetOffset(this.target);
				} else {
						throw "Target of offset must be a string value";
				}
		}
}

IntOffset.prototype.NativeValue = function() {
    if (this.nofuzz || this.fuzzcombo === 0) {
				return this.calcOffset();
    } else {
				var comb = this.fuzzcombo - 1;
				if(comb < this.modifiers.length) {
						return this.modifiers[comb] + this.calcOffset();
				}
        // if we are fuzzing offsets 
        // combo = 0 count target, else
        // return fuzzed integer
        return this.values[this.fuzzcombo-1-this.modifiers.length];
    }
};

IntOffset.prototype.Value = function() {
    // if we are not fuzzing offsets
    // then count our target
    var myvalue =  this.stringify(this.NativeValue());
    if(myvalue === undefined) {
        throw "attempting to return undefined value";
    }
    return myvalue;
};

IntOffset.prototype.Combos = function() {
    if (this.nofuzz) {
        return 1;
    } else {
        return 1 + this.modifiers.length + Int.prototype.Combos.call(this);
    }

};

IntOffset.prototype.HelpGC = function() {
		Int.prototype.HelpGC.call(this);
		delete this.target;
		this.target = undefined;
    delete this.calcfunc;
    this.calcfunc = undefined;
};

/////////////////////////////
// Blob type -- used to munge 
// binary data
/////////////////////////////

function Blob(kwargs) {
    DataItem.call(this, kwargs);

    this.blob = kwargs['blob'];
		this.generator = kwargs['generator'];
		this.length = kwargs['length'];
};

Blob.prototype = new DataItem({});
Blob.prototype.constructor = Blob;

Blob.prototype.Size = function() {
		if (this.length instanceof Function) {
				return this.length.call(this, this.seed, this.parent, this.root);
		} else {
				return this.length;
		}
};

Blob.prototype.Value = function() {
    // need to somehow use a real fuzzer?
    var myvalue = "";

    if(this.length === 0) {
        // short circuit: empty string for empty blob
        return "";
    }

    if(this.generator) {
        //console.log(this.name + ": Calling generator");
        myvalue =  this.generator.call(this, this.Size());
    } else {
        //console.log(this.name + ": there is a static blob");
        myvalue =  this.blob;
    }

    if(myvalue === undefined) {
        throw "attempting to return undefined value";
    }

    return myvalue;
};

Blob.prototype.NativeValue = Blob.prototype.Value;

Blob.prototype.Combos = function() {
    // need to somehow use a real fuzzer?
    return 1;
};

Blob.prototype.HelpGC = function() {
		DataItem.prototype.HelpGC.call(this);
    delete this.blob;
    this.blob = undefined;
		delete this.generator;
		this.generator = undefined;
};

