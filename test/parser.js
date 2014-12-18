var assert = require("assert");

// For now, we need an `elementQuery` object in the global space for the
// parser to attach to. This could probably be done better in the future.
global.elementQuery = {
  classNameForRules: function(rules) {
    var name = "query";
    for (var i = 0, len = rules.length; i < len; i++) {
      name += "_" + rules[i].property + "_" + rules[i].value + rules[i].units;
    }
    return name;
  }
}
require("../lib/parser.js");

describe("Parser", function() {
  
  it("can detect a simple element query", function() {
    var result = elementQuery.parser.parseStyleText(
      ".test-element:media(max-available-width: 30em) { background: purple; }"
    );
    assert.equal(result.queries.length, 1, "Should have found 1 query.");
    assert.equal(result.queries[0].selector, ".test-element", "The selector for the query should be '.test-element'.");
    
    assert.equal(result.queries[0].rules.length, 1, "There should be one rule in the query.");
    assert.equal(result.queries[0].rules[0].property, "max-available-width", "The query should be for 'max-available-width'.");
    assert.equal(result.queries[0].rules[0].value, 30, "The query's value should be 30.");
    assert.equal(result.queries[0].rules[0].units, "em", "The query's units should be 'em'");
  });
  
});
