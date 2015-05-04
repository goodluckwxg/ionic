import {NgElement} from 'angular2/angular2';
import * as util from 'ionic/util';

/*
 * Used be tabs and nav
 */
export class NavBase {
  constructor(
    element: NgElement
  ) {
    this.domElement = element.domElement;

    // this is our sane stack of items. This is synchronous and says an item
    // is removed even if it's still animating out.
    this._stack = [];

    // The navItems array is what add/remove components from the dom.
    // These arrays won't remove a component until they're
    // done animating out.
    this.navItems = [];
  }

  containsClass(Class) {
    for (let i = 0; i < this._stack.length; i++) {
      if (this._stack[i].Class === Class) {
        return true
      }
    }
    return false
  }

  set initial(Class) {
    if (!this.initialized) {
      this.initialized = true
      this.push(Class, {}, {
        animation: 'none'
      });
    }
  }

  /**
   * Push a new view into the history stack.
   */
  push(Class: Function, params = {}, opts = {}) {
    let pushedItem = new NavStackData(Class, params);

    this._stack.push(pushedItem);
    this.navItems.push(pushedItem);

    return pushedItem.setup().then(() => {
      let current = this._getPrevious(pushedItem);
      current && current.leaveReverse(opts);
      return pushedItem.enter(opts);
    });
  }

  /**
   * Pop a view off the history
   */
  pop(opts = {}) {
    let current = this._stack.pop()
    let dest = this.last()

    dest && dest.enterReverse(opts)
    return current && current.leave(opts)
      .then(() => this._destroy(current))
  }

  last() {
    return this._stack[this._stack.length - 1]
  }

  length() {
    return this._stack.length;
  }

  popAll() {
    while (this._stack.length) {
      const item = this._stack.pop()
      this._destroy(item)
    }
  }

  // Pop from the current item to the item at the specified index.
  // Removes every item in the stack between the current and the given index,
  // then performs a normal pop.
  popTo(index, opts = {}) {
    // Abort if we're already here.
    if (this._stack.length <= index + 1) {
      return Promise.resolve();
    }

    // Save the current navItem, and remove all the other ones in front of our
    // target nav item.
    const current = this._stack.pop()
    while (this._stack.length > index + 1) {
      const item = this._stack.pop()
      this._destroy(item)
    }

    // Now put the current navItem back on the stack and run a normal pop animation.
    this._stack.push(current)
    return this.pop(opts)
  }

  setStack(stack) {
    this._stack = stack.slice()
    this.navItems = stack.slice()
  }

  remove(index) {
    const item = this._stack[index]
    this._stack.splice(index, 1)
    this._destroy(item)
  }

  _destroy(navItem) {
    util.array.remove(this.navItems, navItem)
  }

  _getPrevious(item) {
    return this._stack[ this._stack.indexOf(item) - 1 ]
  }

  getToolbars(pos: String) {
    let last = this.last();
    return last && last.navItem && last.navItem._toolbars[pos] || [];
  }
}

class NavStackData {
  constructor(ComponentClass, params = {}) {
    this.Class = ComponentClass;
    this.params = params;
    this._setupPromise = new Promise((resolve) => {
      this._resolveSetupPromise = resolve;
    });
  }

  setup() {
    return this._setupPromise;
  }

  finishSetup(navItem, componentInstance) {
    this.navItem = navItem
    this.instance = componentInstance
    this._resolveSetupPromise()
  }

  setAnimation(state) {
    if (!state) {
      this.navItem.domElement.removeAttribute('animate')
      this.navItem.domElement.classList.remove('start')
    } else {
      this.navItem.domElement.setAttribute('animate', state)
    }
  }

  setShown(isShown) {
    this.navItem.domElement.classList[isShown?'add':'remove']('shown')
  }

  startAnimation() {
    this.navItem.domElement.classList.add('start')
  }

  _animate({ isShown, animation }) {
    this.setAnimation(animation)
    this.setShown(isShown)
    if (animation) {
      // We have to wait two rafs for the element to show. Yawn.
      return util.dom.rafPromise().then(util.dom.rafPromise).then(() => {
        this.startAnimation()
        return util.dom.transitionEndPromise(this.navItem.domElement).then(() => {
          this.setAnimation(null)
        })
      })
    } else {
      return Promise.resolve()
    }
  }

  enterReverse(opts) {
    return this.enter( util.extend({reverse: true}, opts) )
  }

  enter({ reverse = false, sync = false } = {}) {
    return this._animate({
      isShown: true,
      animation: sync ? null : (reverse ? 'enter-reverse' : 'enter')
    })
  }

  leave({ reverse = false, sync = false } = {}) {
    return this._animate({
      isShown: false,
      animation: sync ? null : (reverse ? 'leave-reverse' : 'leave')
    })
  }

  leaveReverse(opts) {
    return this.leave( util.extend({reverse: true}, opts) )
  }

}