(function() {
  var commentPattern = /(\/\*)[\s\S]*?(\*\/)/g;
  var cssRulePattern = /\s*([^{]+)\{([^}]*)\}\s*/g;
  var queryPattern = /:media\s*\(([^)]*)\)/g;
  var selectorPattern = /(?:^|\})\s*([^{]+)\s*/g;
  var queryRulesPattern = /\(?([^\s:]+):\s*(\d+(?:\.\d+)?)(px|em)\)?/g;
  var mediaPattern = /(@media[^{]*)\{((?:\s*([^{]+)\{([^}]*)\}\s*)*)\}/g

  var queryMatchers = {
    "max-available-width": function(element, value) {
      var value = parseInt(value, 10);
      var parent = element.parentNode;
      return value && parent && parent.offsetWidth <= value;
    },

    "min-available-width": function(element, value) {
      var value = parseInt(value, 10);
      var parent = element.parentNode;
      return value && parent && parent.offsetWidth >= value;
    },
  };

  var queries = [];

  var query = {
    selector: "string",
    className: "string",
    match: function() {}
  };

  var ElementQuery = function() {};

  var queriesForSelector = function(selectorString) {
    var selectors = selectorString.split(",");
    var selectorResults = [];
    var queryResults = [];
    for (var i = 0, len = selectors.length; i < len; i++) {
      var result = queriesForSingleSelector(selectors[i]);
      selectorResults.push(result.selector);
      queryResults = queryResults.concat(result.queries);
    }
    return {
      selector: selectorResults.join(","),
      queries: queryResults
    };
  };

  var queriesForSingleSelector = function(selectorString) {
    var queries = [];
    var newSelector = "";
    var lastIndex = 0;
    var queryMatch;
    while (queryMatch = queryPattern.exec(selectorString)) {
      var querySelector = selectorString.slice(0, queryMatch.index);
      var queryRules = parseQuery(queryMatch[1]);
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
  };

  var parseQuery = function(queryString) {
    var rules = [];
    var ruleMatch;
    while (ruleMatch = queryRulesPattern.exec(queryString)) {
      rules.push({
        property: ruleMatch[1],
        value: parseFloat(ruleMatch[2]),
        units: ruleMatch[3]
      });
    }
    return rules;
  };

  var classNameForRules = function(rules) {
    var name = "query";
    for (var i = 0, len = rules.length; i < len; i++) {
      name += "-" + rules[i].property + "-" + rules[i].value + rules[i].units;
    }
    return name;
  }




  var scanStyleSheets = function(sheets, callback) {
    var completed = 0;
    for (var i = 0, len = sheets.length; i < len; i++) {
      scanStyleSheet(sheets[i], function() {
        completed += 1;
        if (completed === len) {
          callback && callback();
        }
      });
    }
  };

  var scanStyleSheet = function(sheet, callback) {
    if (sheet.ownerNode.nodeName === "STYLE") {
      var newStyles = scanStyleString(sheet.ownerNode.innerHTML);
      sheet.ownerNode.innerHTML += newStyles;
      callback && callback();
    }
    else if (sheet.href) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", sheet.href, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            var newStyles = scanStyleString(xhr.responseText);
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
  };

  var scanStyleString = function(sheet) {
    // new stylesheet content to add (replacing rules with `:media()` in them)
    var newRules = "";

    // remove comments
    sheet = sheet.replace(commentPattern, "");

    // manage vanilla media queries
    var mediaRules = "";
    sheet = sheet.replace(mediaPattern, function(mediaString, query, content) {
      var newMediaRules = scanStyleString(content);
      if (!/^\s*$/.test(newMediaRules)) {
        mediaRules += query + "{\n" + newMediaRules + "\n}\n";
      }
      return "";
    });

    var ruleMatch;
    while (ruleMatch = cssRulePattern.exec(sheet)) {
      var results = queriesForSelector(ruleMatch[1]);
      if (results.queries.length) {
        newRules += results.selector + "{" + ruleMatch[2] + "}\n";
        queries.push.apply(queries, results.queries);
      }
    }
    return newRules + "\n" + mediaRules;
  };

  var elementMatchesRules = function(element, rules) {
    for (var i = rules.length - 1; i > -1; i--) {
      var rule = rules[i];
      var matcher = queryMatchers[rule.property];
      if (matcher && !matcher(element, rule.value)) {
        return false;
      }
    }
    return true;
  };

  var evaluateQueries = function() {
    for (var i = 0, len = queries.length; i < len; i++) {
      var elements = document.querySelectorAll(queries[i].selector);
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
    scanStyleSheets(document.styleSheets, function() {
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