function* walkObject(val) { 
  if (typeof val === "object") {
    for (const key in val) {
      yield* walkObject(val[key])
    }
  }
  yield val
}

console.log([...walkObject({
  a: {
    b: {
      c: {
        g: {}
      }
    }  
  },
  d: {
    e: {}
  }
})])


/****
 * object walker
 * {
 *    a: {
 *        b: {
 *            c: {
 *              g: {
 * }
 *        }  
 *    }
 *  },
 *  d: {
 *    e: {}
 * }
 * }
 */