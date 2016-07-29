module.exports = function (babel) {
  "use strict";
  var t = babel.types;

  var visitor = parser({
    t: t,
    pre: function pre(state) {
      var tagName = state.tagName;
      var args = state.args;
      if (t.react.isCompatTag(tagName)) {
        args.push(t.stringLiteral(tagName));
      } else {
        args.push(state.tagExpr);
      }
    },

    post: function post(state, pass) {
      state.callee = pass.get("jsxIdentifier");
    }
  });

  visitor.Program = function (path, state) {
    var id = state.opts.pragma || "h";

    state.set("jsxIdentifier", id.split(".").map(function (name) {
      return t.identifier(name);
    }).reduce(function (object, property) {
      return t.memberExpression(object, property);
    }));
  };

  return {
    inherits: require("babel-plugin-syntax-jsx"),
    visitor: visitor
  };
};

function parser(opts) {
  var t = opts.t;
  var visitor = {};

/*
  visitor.JSXNamespacedName = function (path) {
    throw path.buildCodeFrameError("Namespace tags are not supported yet.");
  };
  */

  visitor.JSXElement = {
    exit: function exit(path, file) {
      var callExpr = buildElementCall(path.get("openingElement"), file);

      var concatExpression = [];

      if (path.node.children.length) {
        var emptyArray = t.arrayExpression([]);
        var emptyArrayDotConcat = t.memberExpression(emptyArray, t.identifier("concat"));
        concatExpression = t.callExpression(emptyArrayDotConcat, path.node.children);
      }

      callExpr.arguments = callExpr.arguments.concat(concatExpression); // path.node.children

      if (callExpr.arguments.length >= 3) {
        callExpr._prettyCall = true;
      }

      path.replaceWith(t.inherits(callExpr, path.node));
    }
  };

  return visitor;

  function convertJSXIdentifier(node, parent) {
    if (t.isJSXIdentifier(node)) {
      if (node.name === "this" && t.isReferenced(node, parent)) {
        return t.thisExpression();
      } else if (/^[A-Z]/.test(node.name)) {
        // node is assumed to be a JS identifier (var, function, class, etc) if the first letter is UPPERCASE
        node.type = "Identifier";
      } else {
        return t.stringLiteral(node.name);
      }
    } else if (t.isJSXMemberExpression(node)) {
      return t.memberExpression(convertJSXIdentifier(node.object, node), convertJSXIdentifier(node.property, node));
    }

    return node;
  }

  function convertAttributeValue(node) {
    if (t.isJSXExpressionContainer(node)) {
      return node.expression;
    } else {
      return node;
    }
  }

  function convertAttribute(node) {
    var value = convertAttributeValue(node.value || t.booleanLiteral(true));

    if (t.isStringLiteral(value)) {
      value.value = value.value.replace(/\n\s+/g, " ");
    }

    if (t.isValidIdentifier(node.name.name)) {
      node.name.type = "Identifier";
    } else {
      var nodeName = node.name.namespace ? node.name.namespace.name + ":" + node.name.name.name : node.name.name;
      node.name = t.stringLiteral(nodeName);
    }

    return t.inherits(t.objectProperty(node.name, value), node);
  }

  function buildElementCall(path, file) {
    path.parent.children = t.react.buildChildren(path.parent);

    var tagExpr = convertJSXIdentifier(path.node.name, path.node);
    var args = [];

    var tagName = undefined;
    if (t.isIdentifier(tagExpr)) {
      tagName = tagExpr.name;
    } else if (t.isLiteral(tagExpr)) {
      tagName = tagExpr.value;
    }

    var state = {
      tagExpr: tagExpr,
      tagName: tagName,
      args: args
    };

    if (opts.pre) {
      opts.pre(state, file);
    }

    var attribs = path.node.attributes;
    if (attribs.length) {
      attribs = buildOpeningElementAttributes(attribs, file);
    } else {
      attribs = t.objectExpression([]);
      // attribs = t.nullLiteral();
    }

    args.push(attribs);

    if (opts.post) {
      opts.post(state, file);
    }

    return state.call || t.callExpression(state.callee, args);
  }

  function groupAttributes(props) {
    var attributes = [];

    // group props based on prefix (prefix-name)

    props.forEach(prop => {
      var propName = prop.key.name || prop.key.value;
      var propNameSplitOnDash = propName.split("-");
      if (propNameSplitOnDash.length > 1) { // contains -
        var prefix = propNameSplitOnDash[0];
        var suffix = propNameSplitOnDash[1];
        // check if node already contains property with name prefix
        var propertyWithPrefix = attributes.find(p => p.key.name === prefix);
        var suffixProperty = t.objectProperty(t.identifier(suffix), prop.value);
        if (!propertyWithPrefix) {
          propertyWithPrefix = t.objectProperty(t.identifier(prefix), t.objectExpression([suffixProperty]));
          attributes.push(propertyWithPrefix);
        } else {
          propertyWithPrefix.value.properties.push(
            suffixProperty
          );
        }
      } else if (propName.endsWith("_")) {

        attributes.push(t.objectProperty(t.identifier(propName.replace(/_$/, "")), prop.value));
      } else {

        // push to attrs property
        var attrsProperty = attributes.find(p => p.key.name === "attrs");
        if (!attrsProperty) {
          attrsProperty = t.objectProperty(t.identifier("attrs"), t.objectExpression([prop]));
          attributes.push(attrsProperty);
        } else {
          attrsProperty.value.properties.push(prop);
        }
        // attributes.push(prop);
      }
    });

    return attributes;

    //obj.properties = obj.properties.concat(attributes);
    //return obj;
  }

  /**
   * The logic for this is quite terse. It's because we need to
   * support spread elements. We loop over all attributes,
   * breaking on spreads, we then push a new object containg
   * all prior attributes to an array for later processing.
   */

  function buildOpeningElementAttributes(attribs, file) {
    var _props = [];
    var objs = [];

    function pushProps() {
      if (!_props.length) return;

      objs.push(t.objectExpression(_props));
      _props = [];
    }

    while (attribs.length) {
      var prop = attribs.shift();
      if (t.isJSXSpreadAttribute(prop)) {
        pushProps();
        objs.push(prop.argument);
      } else {
        _props.push(convertAttribute(prop));
      }
    }

    pushProps();

    if (objs.length === 1) {
      // only one object
      attribs = objs[0];
      attribs = t.objectExpression( groupAttributes(attribs.properties));
      // group attribs based on
    } else {
      // looks like we have multiple objects
      if (!t.isObjectExpression(objs[0])) {
        objs.unshift(t.objectExpression([]));
      }

      // spread it
      attribs = t.callExpression(file.addHelper("extends"), objs);
    }

    return attribs;
  }
}
