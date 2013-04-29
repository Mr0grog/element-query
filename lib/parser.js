(function(elementQuery) {
  // Regexes for parsing
  var COMMENT_PATTERN = /(\/\*)[\s\S]*?(\*\/)/g;
  var CSS_RULE_PATTERN = /\s*([^{]+)\{([^}]*)\}\s*/g;
  var QUERY_PATTERN = /:media\s*\(([^)]*)\)/g;
  var QUERY_RULES_PATTERN = /\(?([^\s:]+):\s*(\d+(?:\.\d+)?)(px|em|rem|vw|vh|vmin|vmax)\)?/g;
  var MEDIA_PATTERN = /(@media[^{]*)\{((?:\s*([^{]+)\{([^}]*)\}\s*)*)\}/g;

  /**
   * el-cheapo parser. It at least screws up nested @media rules
   * and puts things that were in @media rules out-of-order
   */
  elementQuery.parser = {
    // parse the raw text of a style sheet for element queries
    parseStyleText: function(sheet) {
      // new stylesheet content to add (replacing rules with `:media()` in them)
      var newRules = "";

      // remove comments
      sheet = sheet.replace(COMMENT_PATTERN, "");

      // manage vanilla media queries
      var mediaRules = "";
      var parser = this;
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
          elementQuery.queries.push.apply(elementQuery.queries, results.queries);
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
        var className = elementQuery.classNameForRules(queryRules);
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

}(elementQuery));