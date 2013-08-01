# Binfuzz.js

Binfuzz.js is a library for fuzzing structured binary data in JavaScript. Structured binary data is data that can be easily represented by one or more C structures. That is, the data is composed of fixed size fields, and any variable length fields are counted by another structure member. Examples of structured binary data include SSL, DNS, and most image formats. Things that aren't structured binary data include languages (such as HTML or JavaScript) or text-based protocols (such as HTTP) or text-based file formats (such as PDF). 

Binfuzz.js uses the definition of a structure to create instances of the structure with invalid or edge-case values. The demos included use Binfuzz.js to generate Windows ICO files to stress your browser's icon parsing and display code. All icon files are generated from the structural definition of an ICO file. Each ICO file contains many images of different sizes (for optimal display on different resolutions). Binfuzz.js will generate ICO files that try to break your browser's icon drawing code.

# How It Works

Binfuzz.js instantiates a new structure from a structure definition. Structure definitions are designed to be simple to specify. 
Below is a comparison of declaring a C structure:

```C
struct inner {
  uint16_t foo;
  char bar[12];
};

struct outer {
  uint32_t magic; // should be 0xDEADBEEF
  struct inner in;
};
```

and declaring the same structure in Binfuzz.js:

```JavaScript
var outer = new Container({'name': 'outer'});
var inner = new Container(
        {'root': outer, 'name': 'inner'});
    inner.addChild( new UInt16(
        {'root': outer, 'name': 'foo'} ));

    inner.addChild( new Blob(
        {'root': outer, 'name': 'bar',
         'length': 12}));

outer.addChild( new UInt32 (
    {'root': outer, 'name': 'magic',
     'constant': 0xDEADBEEF} ));
outer.addChild( inner );
```

# Supported Features

Binfuzz.js includes support for:

*   Pre-Defined Elementary Types:
    * Int8
    * Int16
    * Int32
    * Blob

*   Constants (values that should never be fuzzed)
*   Enumerations (pick a value from a set of valid values)
*   Nested structures
*   Arrays
*   Counter Fields (e.g. field A = number of elements in Array B)
*   Length Fields (e.g. field A = length of Blob B)
*   File Offsets (e.g. field A = how far from the start of the file is Blob B?
*   Custom population functions (e.g. field A = fieldB.length + fieldC.length)

Each elementary integer type has pre-defined interesting fuzzing targets; that is, values that are likely to be edge cases. The Blob type includes a random data generation helper.

# Combinatorics

Binfuzz.js calculates the total number of combinations based on how many possible combinations there are for each individual field. It is then possible to generate a structured data instance corresponding to a specific combination number. It is not necessary to generate prior combinations. This way random combinations can be selected when fuzzing time is limited.

Below is an example that uses the using standard "interesting" values for default elementary types, and also uses a constant and an enumeration.

Start with the following structure definition.
```C
struct fuzzme {
    uint32_t magic; // 0xDEADBEEF
    uint32_t size;
    uint8_t type; // valid values are 0, 1, 2, 7
    char data[256];
};
```

The definition converted to Binfuzz.js would be:
```JavaScript
var fuzzme = new Container({'name': 'fuzzme'});
fuzzme.addChild( new UInt32({
    'root': fuzzme,
    'name': 'magic',
    'constant': 0xDEADBEEF}));
fuzzme.addChild( new IntSize({
    'root': fuzzme,
    'name': 'size',
    'bytesize': 4,
    'target': fuzzme}));
fuzzme.addChild( new UInt8({
    'root': fuzzme,
    'name': 'type',
    'values': [0,1,2,7] }));
fuzzme.addChild( new Blob({
  'root': fuzzme,
  'name': 'data',
  'generator': makeRandomString,
  'length': 256 }));
console.log('Combinations: ' + fuzzme.Combos());
```
This example will generate: `Combinations: 168`. 

# Future Work
There are a few more features I would like to see in Binfuzz.js; hopefully I can find the time to add them.

## Common Format Libraries
Certain patterns are repeated very frequently, such as Integer size followed by a Blob. These shouldn't have to be re-created, but instead made as new elementary types distributed with Binfuzz.js.

## Permutation of Blobs with generic fuzzers
Right now blob generation is very weak. There are plenty of existing binary fuzzers that can be run on unkown binary blobs.

## Memory Usage
Binfuzz.js has very serious memory usage issues that are especially a problem on mobile devices. It would be nice to have some kind of built-in memory usage limit.

# Contact
If you have any questions, please contact me via email: artem [at] dinaburg.org
