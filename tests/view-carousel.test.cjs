const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function element() {
  const listeners = {};
  const classes = new Set();
  return {
    style: {}, dataset: {}, scrollHeight: 420, scrollLeft: 0, isConnected: true,
    listeners,
    classList: {
      add: cls => classes.add(cls),
      remove: cls => classes.delete(cls),
      contains: cls => classes.has(cls),
      toggle: (cls, active) => active ? classes.add(cls) : classes.delete(cls)
    },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    setAttribute() {},
    getBoundingClientRect: () => ({ top: 510, height: 90 })
  };
}

function makePage() {
  const names = ['money', 'todo', 'shopping'];
  const viewport = element(), track = element();
  const panels = Object.fromEntries(names.map(name => [name, element()]));
  const tabs = names.map(name => Object.assign(element(), { dataset: { view: name } }));
  const person = Object.assign(element(), { dataset: { personKey: 'randy' } });
  const todo = element(), todoDetails = element();
  todo.querySelector = selector => selector === 'details.note-details' ? todoDetails : null;
  const todoToggle = Object.assign(element(), { dataset: { toggle: 'task-1' } });
  todoToggle.closest = selector => selector === '.todo-item' ? todo : null;
  todo.closest = () => null;
  const shopping = element();
  shopping.closest = () => null;
  const shopToggle = Object.assign(element(), { dataset: { shopToggle: 'item-1' } });
  shopToggle.closest = selector => selector === '.shop-item' ? shopping : null;
  const elements = { viewViewport: viewport, viewTrack: track,
    moneyPanel: panels.money, todoPanel: panels.todo, shoppingPanel: panels.shopping };
  const document = {
    getElementById: id => elements[id] || null,
    querySelectorAll: selector => ({ '.tab-switch': tabs,
      '#personList > details.person': [person],
      '#todoPanel input[data-toggle]': [todoToggle],
      '#shoppingPanel input[data-shop-toggle]': [shopToggle] }[selector] || []),
    querySelector: () => null
  };
  const timers = [];
  const scrolls = [];
  const window = {
    innerHeight: 640, scrollY: 50, addEventListener() {}, dispatchEvent() {},
    scrollTo: args => scrolls.push(args)
  };
  const location = { hash: '', pathname: '/index.html', search: '' };
  const context = {
    document, window, location, history: { replaceState() {} },
    requestAnimationFrame: fn => fn(),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'view.js'), 'utf8'), context);
  return { view: window.RunningTabView, viewport, track, person, todo, todoDetails,
    shopping, timers, scrolls };
}

test('widget navigation scrolls vertically without shifting the horizontal carousel', () => {
  const page = makePage();
  page.viewport.scrollLeft = 122; // Reproduce the stale offset from the previous implementation.
  page.view.openItem('todo', 'task-1');
  assert.equal(page.viewport.scrollLeft, 0);
  assert.equal(page.track.style.transform, 'translate3d(-100%,0,0)');
  assert.equal(page.todoDetails.open, true);
  assert.equal(page.todo.classList.contains('widget-jump-highlight'), true);
  const scrollTimer = page.timers.find(timer => timer.ms === 320);
  assert.ok(scrollTimer);
  scrollTimer.fn();
  assert.equal(page.scrolls.length, 1);
  assert.equal(page.scrolls[0].left, 0);
  assert.equal(page.scrolls[0].behavior, 'smooth');
  page.viewport.scrollLeft = 60;
  page.view.show('shopping');
  assert.equal(page.viewport.scrollLeft, 0);
  assert.equal(page.track.style.transform, 'translate3d(-200%,0,0)');
  page.view.show('money');
  assert.equal(page.track.style.transform, 'translate3d(-0%,0,0)');
});

test('a widget contact and shopping row reveal only their own entries', () => {
  const page = makePage();
  page.view.openItem('money', 'Randy');
  assert.equal(page.person.open, true);
  assert.equal(page.person.classList.contains('widget-jump-highlight'), true);
  page.view.openItem('shopping', 'item-1');
  assert.equal(page.shopping.classList.contains('widget-jump-highlight'), true);
  assert.equal(page.track.style.transform, 'translate3d(-200%,0,0)');
});

test('a left swipe still snaps to the next complete category', () => {
  const page = makePage();
  page.view.openItem('todo', 'task-1');
  page.viewport.listeners.touchstart({ touches: [{ clientX: 250, clientY: 100 }] });
  page.viewport.listeners.touchend({ changedTouches: [{ clientX: 125, clientY: 104 }] });
  assert.equal(page.track.style.transform, 'translate3d(-200%,0,0)');
  assert.equal(page.viewport.scrollLeft, 0);
});
