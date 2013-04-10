(function() {
  // Regexes for parsing
  var COMMENT_PATTERN = /(\/\*)[\s\S]*?(\*\/)/g;
  var CSS_RULE_PATTERN = /\s*([^{]+)\{([^}]*)\}\s*/g;
  var QUERY_PATTERN = /:media\s*\(([^)]*)\)/g;
  var QUERY_RULES_PATTERN = /\(?([^\s:]+):\s*(\d+(?:\.\d+)?)(px|em|rem|vw|vh|vmin|vmax)\)?/g;
  var MEDIA_PATTERN = /(@media[^{]*)\{((?:\s*([^{]+)\{([^}]*)\}\s*)*)\}/g;

  // implementations for testing actual element query properties
  var queryMatchers = {
    "max-available-width": function(element, value, units) {
      var parent = element.parentNode;
      var px = convertToPx(parent, value, units);
      return value && parent && parent.offsetWidth <= px;
    },

    "min-available-width": function(element, value, units) {
      var parent = element.parentNode;
      var px = convertToPx(parent, value, units);
      return value && parent && parent.offsetWidth >= px;
    },
  };

  // list of known queries that need matching
  var queries = [];

  // convert an element query into a css class name we can replace it with
  var classNameForRules = function(rules) {
    var name = "query";
    for (var i = 0, len = rules.length; i < len; i++) {
      name += "_" + rules[i].property + "_" + rules[i].value + rules[i].units;
    }
    return name;
  };
  
  // determine the px value for a measurement (e.g. "5em") on a given element
  var convertToPx = function(element, value, units) {
    switch (units) {
      case "px": return value;
      case "em": return value * getEmSize(element);
      case "rem": return value * getEmSize();
      // Viewport units!
      // According to http://quirksmode.org/mobile/tableViewport.html
      // documentElement.clientWidth/Height gets us the most reliable info
      case "vw": return value * document.documentElement.clientWidth / 100;
      case "vh": return value * document.documentElement.clientHeight / 100;
      case "vmin":
      case "vmax":
        var vw = document.documentElement.clientWidth / 100;
        var vh = document.documentElement.clientHeight / 100;
        var chooser = Math[units === "vmin" ? "min" : "max"];
        return value * chooser(vw, vh);
      default: return value;
      // for now, not supporting physical units (since they are just a set number of px)
      // or ex/ch (getting accurate measurements is hard)
    }
  };
  
  // determine the size of an em in a given element
  var getEmSize = function(element) {
    if (!element) {
      element = document.documentElement;
    }
    if (window.getComputedStyle) {
      return parseFloat(getComputedStyle(element).fontSize) || 16;
    }
    // TODO: support IE?
    return 16;
  };

  // test whether an element matches a set of query rules
  var elementMatchesRules = function(element, rules) {
    for (var i = rules.length - 1; i > -1; i--) {
      var rule = rules[i];
      var matcher = queryMatchers[rule.property];
      if (matcher && !matcher(element, rule.value, rule.units)) {
        return false;
      }
    }
    return true;
  };

  // re-evaluate all the queries
  var evaluateQueries = function(context) {
    context = context || document;
    for (var i = 0, len = queries.length; i < len; i++) {
      var elements = context.querySelectorAll(queries[i].selector);
      for (var j = 0; j < elements.length; j++) {
        var element = elements[j];
        if (elementMatchesRules(element, queries[i].rules)) {
          element.classList.add(queries[i].className);
        }
        else {
          element.classList.remove(queries[i].className);
        }
      }
    }
  };




  // el-cheapo parser. It at least screws up nested @media rules
  // and puts things that were in @media rules out-of-order
  var parser = {
    // parse an array of CSSStyleSheet objects for element queries
    parseStyleSheets: function(sheets, callback) {
      var completed = 0;
      for (var i = 0, len = sheets.length; i < len; i++) {
        this.parseStyleSheet(sheets[i], function() {
          completed += 1;
          if (completed === len) {
            callback && callback();
          }
        });
      }
    },

    // parse a single CSSStyleSheet object for element queries
    parseStyleSheet: function(sheet, callback) {
      if (sheet.ownerNode.nodeName === "STYLE") {
        var newStyles = parser.parseStyleText(sheet.ownerNode.innerHTML);
        sheet.ownerNode.innerHTML += newStyles;
        callback && callback();
      }
      else if (sheet.href) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", sheet.href, true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {
              var newStyles = parser.parseStyleText(xhr.responseText);
              var style = document.createElement("style");
              style.innerHTML = newStyles;
              document.body.appendChild(style);
            }
            else if (window.console) {
              console.log("Could not load stylesheet at " + sheet.href);
            }
            callback && callback();
          }
        }
        xhr.send(null);
      }
    },

    // parse the raw text of a style sheet for element queries
    parseStyleText: function(sheet) {
      // new stylesheet content to add (replacing rules with `:media()` in them)
      var newRules = "";

      // remove comments
      sheet = sheet.replace(COMMENT_PATTERN, "");

      // manage vanilla media queries
      var mediaRules = "";
      sheet = sheet.replace(MEDIA_PATTERN, function(mediaString, query, content) {
        var newMediaRules = parser.parseStyleText(content);
        if (!/^\s*$/.test(newMediaRules)) {
          mediaRules += query + "{\n" + newMediaRules + "\n}\n";
        }
        return "";
      });

      var ruleMatch;
      while (ruleMatch = CSS_RULE_PATTERN.exec(sheet)) {
        var results = this.queriesForSelector(ruleMatch[1]);
        if (results.queries.length) {
          newRules += results.selector + "{" + ruleMatch[2] + "}\n";
          queries.push.apply(queries, results.queries);
        }
      }
      return newRules + "\n" + mediaRules;
    },

    // find all the queries in a selector
    queriesForSelector: function(selectorString) {
      var selectors = selectorString.split(",");
      var selectorResults = [];
      var queryResults = [];
      for (var i = 0, len = selectors.length; i < len; i++) {
        var result = this.queriesForSingleSelector(selectors[i]);
        selectorResults.push(result.selector);
        queryResults = queryResults.concat(result.queries);
      }
      return {
        selector: selectorResults.join(","),
        queries: queryResults
      };
    },
    
    // find all the queries in a *single* selector (i.e. no commas)
    queriesForSingleSelector: function(selectorString) {
      var queries = [];
      var newSelector = "";
      var lastIndex = 0;
      var queryMatch;
      while (queryMatch = QUERY_PATTERN.exec(selectorString)) {
        var querySelector = selectorString.slice(0, queryMatch.index);
        var queryRules = this.parseQuery(queryMatch[1]);
        var className = classNameForRules(queryRules);
        newSelector += selectorString.slice(lastIndex, queryMatch.index);
        lastIndex = queryMatch.index + queryMatch[0].length;
        queries.push({
          selector: newSelector,
          className: className,
          rules: queryRules
        });
        newSelector += "." + className;
      }
      newSelector += selectorString.slice(lastIndex);
      return {
        selector: newSelector,
        queries: queries
      };
    },

    // find the actual queried properties in an element query
    parseQuery: function(queryString) {
      var rules = [];
      var ruleMatch;
      while (ruleMatch = QUERY_RULES_PATTERN.exec(queryString)) {
        rules.push({
          property: ruleMatch[1],
          value: parseFloat(ruleMatch[2]),
          units: ruleMatch[3]
        });
      }
      return rules;
    }
  };

  // re-run all queries on resize
  window.addEventListener("resize", function() {
    evaluateQueries();
  }, false);

  // TODO: re-run all queries... on an interval?
  // override setTimeout, addEventListener, etc to hit every possible JS entry
  // point? Not really an ideal solution to this.
  // Repaint events in Mozilla?

  // automatically look for things on window load
  window.addEventListener("load", function() {
    var evaluated = false;
    parser.parseStyleSheets(document.styleSheets, function() {
      evaluated = true;
      evaluateQueries();
    });

    // if we are still waiting for some asynchronous ones, go ahead and evaluate
    // any found queries now for minimum latency
    if (!evaluated) {
      evaluateQueries();
    }
  }, false);
}());