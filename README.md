# Element Query

Element query is little JS library designed to enable CSS "element queries," or queries nested inside CSS selectors. While traditional media queries always relate to the viewport or window, element queries relate to the state of particular elements on the page. This allows for *modular* media queries.

Just include the `element-query.js` script on your page and you can start using some basic element queries right away.


## Syntax

At current, only two queries are supported:

- `min-available-width`
- `max-available-width`

These are based on the width of the element containing the selected element.

In addition, `px` are the only units currently supported (this will change).

You can try it out with some CSS like:

```css
.test-element:media(max-available-width: 400px) {
    background: purple;
}
```

In the above CSS, `.test-element` will have a purple background if it is inside an element that is 400px wide or smaller.


## Test

You can also poke around in the HTML and CSS in the `/test` directory. You'll need to run a web server to test loading an external .css file since that sadly requires XHR to work (so you'll hit CORS when loading).

On OS X, an easy way to do this on the command line is:

```
$ cd path/to/element-query
$ python -m SimpleHTTPServer
```


## Righteously Ugly Code

This is super-rough; the product of an afternoon's work and a conversation with @beep, inspired by @ianstormtaylor's blog post: 
http://ianstormtaylor.com/media-queries-are-a-hack/
and @jonathantneal's blog post:
http://www.jonathantneal.com/blog/thoughts-on-media-queries-for-elements/
and @necolas's tweet:
https://twitter.com/necolas/status/299573744307941376

There will still be some refinement to come.
