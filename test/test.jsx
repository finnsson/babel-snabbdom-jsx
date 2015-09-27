var assert = require('assert');

var h = require('snabbdom/h');

describe("loader", function() {
  it("should contain text", function() {
    var dom = <div>test</div>;

    assert.equal("div", dom.sel);
    assert.equal("test", dom.children[0].text);
  });

  it("should bind text", function() {
    var text = "Lorem";
    var dom = <div>{text}</div>;

    assert.equal("div", dom.sel);
    assert.equal(text, dom.children[0].text);
  });

  it("should bind text expressions", function() {
    var text = "Lorem";
    var dom = <div>{text + " ipsum"}</div>;

    assert.equal("div", dom.sel);
    assert.equal("Lorem ipsum", dom.children[0].text);
  });

  it("should extract attrs", function() {
    var dom = <div dir="ltr">test</div>;

    assert.equal("div", dom.sel);
    assert.equal("ltr", dom.data.attrs.dir);
  });

  it("should extract events", function() {
    var doSomething = function() {};
    var dom = <div on-click={doSomething}>test</div>;

    assert.equal("div", dom.sel);
    assert.equal(doSomething, dom.data.on.click);
  });

  it("should extract multiple events", function() {
    var onClick = function() {};
    var onMouseOver = function() {};
    var dom = <div on-click={onClick} on-mouseover={onMouseOver}>test</div>;

    assert.equal("div", dom.sel);
    assert.equal(onClick, dom.data.on.click);
    assert.equal(onMouseOver, dom.data.on.mouseover);
  });

  it("should extract class hash when using multiple -", function() {
    var truthy = true;
    var dom = <div class-bar={false} class-foo={truthy} class-goo={true}>Lorem ipsum</div>;

    assert.equal(true, dom.data.class.foo);
    assert.equal(false, dom.data.class.bar);
    assert.equal(true, dom.data.class.goo);
  });

  it("should extract class hash when using _", function() {
    var truthy = true;
    var dom = <div class_={{
        foo: truthy,
        bar: false,
        goo: true
      }}>Lorem ipsum</div>;

    assert.equal(true, dom.data.class.foo);
    assert.equal(false, dom.data.class.bar);
    assert.equal(true, dom.data.class.goo);
  });

  it("should extract style hash when using _", function() {
    var fontWeight = "bold";
    var dom = <span style_={{
        border: '1px solid #bada55',
        color: '#c0ffee',
        fontWeight: fontWeight
      }}>Lorem ipsum</span>;

    assert.equal("span", dom.sel);
    assert.equal("1px solid #bada55", dom.data.style.border);
    assert.equal("bold", dom.data.style.fontWeight);
    assert.equal("Lorem ipsum", dom.children[0].text);
  });

  it("should put style string as attribute", function() {
    var dom = <span style="color: red">Lorem ipsum</span>;

    assert.equal("color: red", dom.data.attrs.style);
  });

  it("should handle key_", function() {
    var num = 11;
    var dom = <span key_={num}>Foo</span>;

    assert.equal(11, dom.data.key);
  });

  it("should manage children in children", function() {
    var dom = <div>text 1
        <div>first</div>
        <ul>
          <li>list item 1</li>
          <li>list item 2</li>
        </ul>
        text2</div>;

    assert.equal("div", dom.sel);
    var children = dom.children;
    assert.equal("text 1", children[0].text);
    assert.equal("div", children[1].sel);
    assert.equal("ul", children[2].sel);

    var grandChildren = children[2].children;
    assert.equal("li", grandChildren[0].sel);
    assert.equal("list item 1", grandChildren[0].children[0].text);
    assert.equal("list item 2", grandChildren[1].children[0].text);

    assert.equal("text2", children[3].text);
  });

  it("should manage svg", function() {
    var dom = <svg xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg">
        <rect height="100" style="stroke:#ff0000; fill: #0000ff" width="100" x="10" y="10"/>
      </svg>;

    assert.equal("svg", dom.sel);
    assert.equal("http://www.w3.org/1999/xlink", dom.data.attrs["xmlns:xlink"]);
    assert.equal("http://www.w3.org/2000/svg", dom.data.attrs.xmlns);
    assert.equal("rect", dom.children[0].sel);
    assert.equal("100", dom.children[0].data.attrs.height);
    assert.equal("10", dom.children[0].data.attrs.x);
    assert.equal("stroke:#ff0000; fill: #0000ff", dom.children[0].data.attrs.style);
  });

  it("should handle member tag name", function() {
//var tagName = "span";
    var dom = <button.large x="100">Lorem
        <span></span>
      </button.large>;

    assert.equal("button.large", dom.sel);
    assert.equal("span", dom.children[1].sel);

  });

// spread operator ... {...props} => props_={{props}}

});
