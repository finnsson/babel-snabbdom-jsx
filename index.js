module.exports = function(babel) {
  var t = babel.types;

  function filterNonSpaceLines(text) {
    var lines = text.split(/[\n\r]/);

    var stringArray = [];

    lines.forEach(l => {
      // replace tab with whitespace
      var normalizedLine = l.replace(/\t/g, ' ');
      // remove all extra whitespace
      normalizedLine = normalizedLine.replace(/\s+/g, ' ').replace(/^ /, '').replace(/ $/, '');
      stringArray.push(normalizedLine);
    });

    // only take non-empty lines
    return stringArray.filter(l => l.length).join('');
  }

  function filterChildren(children) {
    return children.filter(child => {
      if (t.isLiteral(child) && child.value == null) {
        return false;
      } else if (t.isLiteral(child) && typeof child.value === 'string') {
        child.value = filterNonSpaceLines(child.value);
        return !!child.value;
      } else {
        return true;
      }
    });
  }

  function getMemberExpressionPath(node) {
    var path = [];

    do {
      path.push(node.property);
    } while (t.isMemberExpression(node = node.object));

    path.push(node);

    return path.reverse();
  }

  // See https://facebook.github.io/jsx/ for API
  return new babel.Transformer('jsx-ir', {

    /*
    JSXElement = JSXSelfClosingElement | JSXOpeningElement JSXChildren? JSXClosingElement
    */
    JSXElement: {
      exit: function(node) {
        var openingElement = node.openingElement;
        var children = filterChildren(node.children, t);

        // get sel index
        var selIndex = openingElement.properties.findIndex(p => {
          return p.key.name === "sel";
        });
        // get sel and remove sel from properties list
        var sel = openingElement.properties.splice(selIndex, 1)[0];

        var args = [sel.value, openingElement];
        if (children.length) {
          args.push(t.arrayExpression(children));
        }

        return t.inherits(t.callExpression(t.identifier("h"), args), node);
      }
    },
    /*
    JSXOpeningElement = < JSXElementName JSXAttribute? >
    */
    JSXOpeningElement: {
      exit: function(node) {
        // extract sel
        var tag;
        if (t.isMemberExpression(node.name)) {
          var tagArray = getMemberExpressionPath(node.name, t);
          var tagType = tagArray[0].type;
          // TODO: check it is not literal instead?
          if (tagType === 'ThisExpression' || tagType === 'Identifier') {
            tag = node.name;
          } else {
            // else treat is as a string with dots
            var tagNames = tagArray.map(t => t.value);
            tag = t.literal(tagNames.join('.'));
          }
        } else {
          tag = node.name;
          // tag = node.name.name || node.name.value;
        }

        var obj = t.objectExpression([
          t.property('init', t.identifier('sel'), tag)
        ]);

        // extract data
        var props = node.attributes;
        if (props && props.length) {
          var attributes = [];

          // group props based on prefix (prefix-name)

          props.forEach(prop => {
            var propName = prop.key.value;
            var propNameSplitOnDash = propName.split("-");
            if (propNameSplitOnDash.length > 1) { // contains -
              var prefix = propNameSplitOnDash[0];
              var suffix = propNameSplitOnDash[1];
              // check if node already contains property with name prefix
              var propertyWithPrefix = attributes.find(p => p.key.name === prefix);
              var suffixProperty = t.property('init', t.identifier(suffix), prop.value);
              if (!propertyWithPrefix) {
                propertyWithPrefix = t.property('init', t.identifier(prefix), t.objectExpression([suffixProperty]));
                attributes.push(propertyWithPrefix);
              } else {
                propertyWithPrefix.value.properties.push(
                  suffixProperty
                );
              }
            } else if (propName.endsWith("_")) {

              attributes.push(t.property('init', t.identifier(propName.replace(/_$/, "")), prop.value));
            } else {

              // push to attrs property
              var attrsProperty = attributes.find(p => p.key.name === "attrs");
              if (!attrsProperty) {
                attrsProperty = t.property('init', t.identifier("attrs"), t.objectExpression([prop]));
                attributes.push(attrsProperty);
              } else {
                attrsProperty.value.properties.push(prop);
              }
              // attributes.push(prop);
            }
          });

          obj.properties = obj.properties.concat(attributes);
        }
        return obj;
      }
    },
    JSXIdentifier: function(node) {
      if (node.name === 'this' && this.isReferenced()) {
        return t.thisExpression();
      } else if (/^[A-Z]/.test(node.name)) {
        // node is assumed to be a JS identifier (var, function, class, etc) if the first letter is UPPERCASE
        node.type = 'Identifier';
      } else {
        // name is assumed to be a normal DOM element (string)
        return t.literal(node.name);
      }
    },
    /*
    JSXNamespacedName = JSXIdentifier : JSXIdentifier
    */
    JSXNamespacedName: function(node) {
      return t.literal(node.namespace.name + ':' + node.name.name);
    },
    /*
    JSXMemberExpression = JSXIdentifier . JSXIdentifier | JSXMemberExpression . JSXIdentifier
    */
    JSXMemberExpression: {
      exit: function(node) {
        node.computed = t.isLiteral(node.property);
        node.type = 'MemberExpression';
      }
    },
    JSXEmptyExpression: function(node) {
      node.type = 'Literal';
      node.value = null;
    },
    JSXExpressionContainer: function(node) {
      return node.expression;
    },
    /*
    JSXAttribute = JSXAttributeName = JSXAttributeValue
    */
    JSXAttribute: {
      enter: function(node) {
        // remove newlines and multiple space in strings and replace with single space
        var value = node.value;
        if (t.isLiteral(value) && typeof value.value === 'string') {
          value.value = value.value.replace(/\n\s+/g, ' ');
        }
      },

      exit: function(node) {
        return t.inherits(t.property('init', node.name, node.value || t.literal(true)), node);
      }
    }
  });
};
