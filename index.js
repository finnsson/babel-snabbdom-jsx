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
      if (t.isLiteral(child) && typeof child.value === 'string') {
        child.value = filterNonSpaceLines(child.value);
        if(child.value) {
          return true;
        }
      } else {
        return true;
      }
    });
  }

  function reduceMemberExpression(node) {
    var tag = [];

    do {
      tag.push(node.property.value);
    } while (t.isMemberExpression(node = node.object));

    tag.push(node.value);

    return tag.reverse();
  }

  return new babel.Transformer('jsx-ir', {
    JSXIdentifier: function(node) {
      if (node.name === 'this' && this.isReferenced()) {
        return t.thisExpression();
      } else {
        return t.literal(node.name);
      }
    },
    JSXNamespacedName: function(node) {
      return t.literal(node.namespace.name + ':' + node.name.name);
    },
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
    JSXAttribute: {
      enter: function(node) {
        // remove newlines and multiple space in strings and replace with single space
        var value = node.value;
        if (t.isLiteral(value) && typeof value.value === 'string') {
          value.value = value.value.replace(/\n\s+/g, ' ');
        }
      },

      exit: function(node) {
        var name = node.name;
        var value = node.value || t.literal(true);

        return t.inherits(t.property('init', name, value), node);
      }
    },
    JSXOpeningElement: {
      exit: function(node) {
        // extract sel
        var tag;
        if (t.isMemberExpression(node.name)) {
          var tagArray = reduceMemberExpression(node.name, t);
          tag = tagArray.join('.');
        } else {
          tag = node.name.name || node.name.value;
        }

        var obj = t.objectExpression([
          t.property('init', t.identifier('sel'), t.literal(tag))
        ]);

        // extract data
        var props = node.attributes;
        if (props) {
          var attributes = [];

          // group props based on prefix (prefix-name)

          props.forEach(prop => {
            var propName = prop.key.value || prop.key.name;
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
    JSXElement: {
      exit: function(node) {
        var item = node.openingElement;
        var children = filterChildren(node.children, t);
        var object;

        // TODO: length: 0 => null, length: 1 => elem, length > 1: [elems]
        children = children.length ? t.arrayExpression(children) : t.literal(null);

        if (t.isCallExpression(item)) {
          object = item.arguments[0];
        } else {
          object = item;
        }

        // get sel index
        var selIndex = object.properties.findIndex(p => {
          return p.key.name === "sel";
        });
        // get sel and remove sel from properties list
        var sel = object.properties.splice(selIndex, 1)[0];

        return t.inherits( t.callExpression(t.identifier("h"), [sel.value, object, children]), node);
      }
    }
  });
};
