import $ from "jquery";
import _ from "lodash";

import Color from "shared/color";
import { Vec2 } from "shared/math";

import Context from "./context";
import Message from "./message";

/**
 * Main renderer class
 * @class
 */
export default class Canvas {
  constructor(context) {
    // Canvas context
    this.context = _.isString(context) || !context
      ? new Context(context)
      : context;

    // Background color
    this.background = Color.parseHex(Color.Hex.BLACK);

    // Application state e.g. game, menu
    this.states = {};
    this.activeState = null;

    // Create DOM actions
    this._initListeners();
  }

  /** Canvas context */
  get ctx() { return this.context.ctx; }

  /** Create event listeners */
  _initListeners() {
    let domInstance = $(this.context.domElement);

    // Translate event from DOM system to engine, "click" to Mouse.Type.MOUSE_CLICK
    let mousePressed = false;
    domInstance.translateEvent = (eventName, eventCode, data) => {
      let handler = () => {
        switch(eventCode) {
          case Message.Type.MOUSE_DOWN: mousePressed = true; break;
          case Message.Type.MOUSE_UP: mousePressed = false; break;
        }
        this.broadcast(new Message(eventCode, this, data));
      };
      return domInstance.on(eventName, handler);
    };

    // On mouse scroll
    let mouseScroll = e => {
      // Custom event data
      class ScrollAmount extends Vec2 {
        constructor(x, y) {
          super(x, y);
          this.amount =  e.originalEvent.deltaY / Math.abs(e.originalEvent.deltaY);
        }

        clone() { return new ScrollAmount(this.x, this.y); }
      }

      // broadcast data
      this.broadcast(new Message(
          Message.Type.MOUSE_SCROLL
        , this
        , new ScrollAmount(mousePos.x, mousePos.y)
      ));
    };

    // Cached mouse position
    let mousePos = new Vec2;
    domInstance
      /** MOUSE EVENT LISTENERS */
      .mousemove(e => {
        mousePos.xy = [
            e.clientX - this.context.size.x
          , e.clientY - this.context.size.y
        ];
        mousePressed && this.broadcast(new Message(Message.Type.MOUSE_DRAG, this, mousePos));
      })

      /** MOUSE SCROLL */
      .on("mousewheel", mouseScroll)

      .translateEvent("click", Message.Type.MOUSE_CLICK, mousePos)
      .translateEvent("mousedown", Message.Type.MOUSE_DOWN, mousePos)
      .translateEvent("mouseup", Message.Type.MOUSE_UP, mousePos);
  }

  /**
   * Broadcast message to states, e.g. keyboard click
   * @param data          Event data
   * @param currentState  If true sends only to visible state
   */
  broadcast(data, currentState=false) {
    if(currentState)
      this.states[this.activeState].onEvent(data);
    else
      _.each(this.states, state => {
        state.onEvent(data);
      });
    data.finalCallback && data.finalCallback();
  }

  /**
   * Set state
   * @param name        State's name
   * @param state       State object
   * @param setDefault  Set state default
   */
  state(name, state, setDefault=false) {
    console.assert(!this.states[name], "Application state already exists!");

    // Set state and init
    this.states[name] = state;
    if(setDefault)
      this.activeState = name;

    // Copy size of parent
    if(!state.rect.w)
      state.rect.wh = this.context.size.wh;

    // Add parent
    state.canvas = this;
    state.init();
    return this;
  }

  /** Game loop */
  run() {
    let lastFrame = Date.now()
      , delta = 0
      , frameTime = 1000 / 30;

    // Render loop
    let renderer = () => {
      // Rendering
      this.ctx.fillStyle = this.background.css;
      this.ctx.fillRect(0, 0, this.context.size.w, this.context.size.h);

      // Stop exec until something is loaded
      if(this.context.currentLoading) {
        let title = "Loading resources...";
        this.context
          .fillWith(Color.Hex.WHITE)
          .setFontSize(32)
          .drawText(title, new Vec2(this.context.size.w / 2 - this.context.textWidth(title) / 2, this.context.size.h / 2 - 6));

      } else {
        let state = this.states[this.activeState];
        if(state) {
          // Fixed step update
          if(delta >= frameTime) {
            delta -= frameTime;
            state.update();
          }

          // Calculate delta
          delta += -lastFrame + (lastFrame = Date.now());
          state.draw(this.context);
        }
      }

      // Request new frame
      window.requestAnimationFrame(renderer);
    };
    renderer();
  }
}
