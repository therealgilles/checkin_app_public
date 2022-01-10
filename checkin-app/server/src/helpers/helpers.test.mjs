import helpers from './helpers'

describe('Testing obscureEmail', () => {
  it('Test #1', () => {
    expect(helpers.obscureEmail('myemailaddress@email.com')).toBe('m••••@email.com')
  })

  it('Test #2', () => {
    expect(helpers.obscureEmail('anotheremailaddress@someserver.com')).toBe('a••••@someserver.com')
  })
})

describe('Testing objHasKey', () => {
  it('Not an object #1', () => {
    expect(helpers.objHasKey(['bla'], 'bla')).toBe(false)
  })

  it('Not an object #2', () => {
    expect(helpers.objHasKey('bla', 'bla')).toBe(false)
  })

  it('Not an object #3', () => {
    expect(helpers.objHasKey(0, '0')).toBe(false)
  })

  it('Empty object', () => {
    expect(helpers.objHasKey({}, 'bla')).toBe(false)
  })

  it('Simple object', () => {
    expect(helpers.objHasKey({ bla: 'data' }, 'bla')).toBe(true)
  })

  it('Array of keys #1', () => {
    expect(helpers.objHasKey({ bla: 'data' }, ['moo', 'foo'])).toBe(false)
  })

  it('Array of keys #2', () => {
    expect(helpers.objHasKey({ bla: 'data', foo: 'bata' }, ['bla', 'moo'])).toBe(true)
  })
})

describe('Testing nameCapitalize', () => {
  it('Name #1', () => {
    expect(helpers.nameCapitalize('firstname lastname')).toBe('Firstname Lastname')
  })

  it('Name #2', () => {
    expect(helpers.nameCapitalize('firstname de lastname')).toBe('Firstname de Lastname')
  })

  it('Name #3', () => {
    expect(helpers.nameCapitalize('firstname von lastname')).toBe('Firstname von Lastname')
  })

  it('Font testcase', () => {
    expect(helpers.nameCapitalize('The quick brown fox jumps over the lazy dog')).toBe(
      'The Quick Brown Fox Jumps Over The Lazy Dog'
    )
  })
})

describe('Testing arrayFlatten', () => {
  it('Empty array', () => {
    expect(helpers.arrayFlatten([])).toEqual([])
  })

  it('Simple array', () => {
    expect(helpers.arrayFlatten([0, 1, 2, 3])).toEqual([0, 1, 2, 3])
  })

  it('2-deep array', () => {
    expect(helpers.arrayFlatten([[0], [1], [2], [3]])).toEqual([0, 1, 2, 3])
  })

  it('3-deep array', () => {
    expect(helpers.arrayFlatten([[[0], [1]], [2], [[3], [4]], [5]])).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('Testing emptyObject', () => {
  it('Empty object', () => {
    const obj = {}
    helpers.emptyObject(obj)
    expect(obj).toEqual({})
  })

  it('Simple object', () => {
    const obj = { bla: 'data', foo: 'bata' }
    helpers.emptyObject(obj)
    expect(obj).toEqual({})
  })
})

describe('Testing redisRestoreObj', () => {
  it('Empty object', () => {
    const obj = {}
    const result = { bla: 'data' }
    helpers.redisRestoreObj(result, obj)
    expect(obj).toEqual(result)
  })

  it('Simple object', () => {
    const obj = { foo: 'bata' }
    const result = { bla: 'data' }
    helpers.redisRestoreObj(result, obj)
    expect(obj).toEqual({ bla: 'data', foo: 'bata' })
  })

  it('Merge object', () => {
    const obj = { foo: 'bata', moo: 'mata' }
    const result = { foo: 'data' }
    helpers.redisRestoreObj(result, obj)
    expect(obj).toEqual({ foo: 'data', moo: 'mata' })
  })

  it('Empty result object', () => {
    const obj = { foo: 'data' }
    const result = {}
    helpers.redisRestoreObj(result, obj)
    expect(obj).toEqual({ foo: 'data' })
  })
})

describe('Testing redisRestoreHash', () => {
  it('Empty result object', () => {
    const hash = { bla: 'data' }
    const result = {}
    helpers.redisRestoreHash(result, hash)
    expect(hash).toEqual({ bla: 'data' })
  })

  it('Hash fill', () => {
    const hash = { bla: 'data' }
    const result = { foo: JSON.stringify('foo data'), moo: JSON.stringify('moo data') }
    helpers.redisRestoreHash(result, hash)
    expect(hash).toEqual({ bla: 'data', foo: 'foo data', moo: 'moo data' })
  })

  it('Hash fill without merge', () => {
    const hash = { settings: { bla: 'bla data' } }
    const result = {
      settings: JSON.stringify({ tut: 'tut data' }),
      foo: JSON.stringify('foo data'),
      moo: JSON.stringify('moo data'),
    }
    helpers.redisRestoreHash(result, hash)
    expect(hash).toEqual({ settings: { tut: 'tut data' }, foo: 'foo data', moo: 'moo data' })
  })

  it('Hash fill with merge', () => {
    const hash = { settings: { bla: 'bla data' } }
    const result = {
      settings: JSON.stringify({ tut: 'tut data' }),
      foo: JSON.stringify('foo data'),
      moo: JSON.stringify('moo data'),
    }
    helpers.redisRestoreHash(result, hash, { merge: true })
    expect(hash).toEqual({
      settings: { bla: 'bla data', tut: 'tut data' },
      foo: 'foo data',
      moo: 'moo data',
    })
  })

  it('Hash fill with override', () => {
    const hash = { settings: { bla: 'bla data' } }
    const result = {
      settings: JSON.stringify({ tut: 'tut data' }),
      foo: JSON.stringify('foo data'),
      moo: JSON.stringify('moo data'),
    }
    helpers.redisRestoreHash(result, hash, { override: { settings: { tut: 'tut new data' } } })
    expect(hash).toEqual({ settings: { tut: 'tut new data' }, foo: 'foo data', moo: 'moo data' })
  })

  it('Hash fill with merge and override', () => {
    const hash = { settings: { bla: 'bla data' } }
    const result = {
      settings: JSON.stringify({ tut: 'tut data' }),
      foo: JSON.stringify('foo data'),
      moo: JSON.stringify('moo data'),
    }
    helpers.redisRestoreHash(result, hash, {
      merge: true,
      override: { settings: { bla: 'bla new data', tut: 'tut new data' } },
    })
    expect(hash).toEqual({
      settings: { bla: 'bla new data', tut: 'tut new data' },
      foo: 'foo data',
      moo: 'moo data',
    })
  })
})

describe('Testing bodyJSONParse', () => {
  it('Missing response', async () => {
    try {
      await helpers.bodyJSONParse()
    } catch (err) {
      if (err.message !== 'Missing response') throw new Error('Message mismatch:', err.message)
      return
    }

    throw new Error('Promise should not be resolved')
  })

  it('body is not a JSON string', async () => {
    const resp = { toJSON: () => ({ body: 'body data' }) }
    try {
      await helpers.bodyJSONParse(resp)
    } catch (err) {
      return
    }

    throw new Error('Promise should not be resolved')
  })

  it('Proper JSON string', async () => {
    const resp = { toJSON: () => ({ body: JSON.stringify('body data') }) }
    try {
      const promise = await helpers.bodyJSONParse(resp)
      expect(promise).toBe('body data')
    } catch (err) {
      throw new Error('Promise was rejected')
    }
  })
})

describe('Testing objValMayBeNumber', () => {
  it('Value is known number', async () => {
    const obj = helpers.objValMayBeNumber({ id: 210 }, 'id', { isNumber: true })
    expect(obj).toEqual({ id: 210 })
  })

  it('Value is known number-like', async () => {
    const obj = helpers.objValMayBeNumber({ id: '210' }, 'id', { isNumber: true })
    expect(obj).toEqual({ id: 210 })
  })

  it('Value is number', async () => {
    const obj = helpers.objValMayBeNumber({ id: 210 }, 'id')
    expect(obj).toEqual({ id: 210 })
  })

  it('Value is number-like', async () => {
    const obj = helpers.objValMayBeNumber({ id: '210' }, 'id')
    expect(obj).toEqual({ id: 210 })
  })

  it('Object is equal but not the same', async () => {
    const obj = { id: 210 }
    const newObj = helpers.objValMayBeNumber(obj, 'id')
    expect(newObj).toEqual(obj)
    expect(newObj).not.toBe(obj)
  })

  it('Object without deep copy', async () => {
    const obj = { id: 210, foo: { bla: 'data' } }
    const newObj = helpers.objValMayBeNumber(obj, 'id')
    expect(newObj).toEqual(obj)
    expect(newObj).not.toBe(obj)
    expect(newObj.foo).toBe(obj.foo)
  })

  it('Object with deep copy', async () => {
    const obj = { id: 210, foo: { bla: 'data' } }
    const newObj = helpers.objValMayBeNumber(obj, 'id', { deepCopy: true })
    expect(newObj).toEqual(obj)
    expect(newObj).not.toBe(obj)
    expect(newObj.foo).not.toBe(obj.foo)
  })
})

describe('Testing getObjFromArrayById', () => {
  it('Array with valid object id #1', async () => {
    expect(helpers.getObjFromArrayById(210, [{ id: 20 }, { id: 210 }, { id: 330 }])).toEqual({
      id: 210,
    })
  })

  it('Array with valid object id #2', async () => {
    expect(helpers.getObjFromArrayById(210, [{ id: 210 }, { id: 20 }, { id: 330 }])).toEqual({
      id: 210,
    })
  })

  it('Array with valid object id #3', async () => {
    expect(helpers.getObjFromArrayById(210, [{ id: 20 }, { id: 30 }, { id: 210 }])).toEqual({
      id: 210,
    })
  })

  it('Array with multiple valid object ids', async () => {
    expect(helpers.getObjFromArrayById(210, [{ id: 210 }, { id: 210 }, { id: 330 }])).toEqual({
      id: 210,
    })
  })

  it('Array without valid object id', async () => {
    expect(helpers.getObjFromArrayById(210, [{ id: 20 }, { id: 220 }, { id: 330 }])).toEqual({})
  })
})

describe('Testing getSlug', () => {
  it('Beginner Class Series March 2019', async () => {
    expect(helpers.getSlug('Beginner Class Series March 2019')).toBe('beginner-class-series')
  })

  it('Drop-in Class March 2019', async () => {
    expect(helpers.getSlug('Drop-in Class March 2019')).toBe('drop-in-class')
  })

  it('DJ Dance Party w/ DJ Alex', async () => {
    expect(helpers.getSlug('DJ Dance Party w/ DJ Alex')).toBe('dj-dance-party')
  })

  it("Live Music w/ Clint Baker's New Orleans Jazz Band", async () => {
    expect(helpers.getSlug("Live Music w/ Clint Baker's New Orleans Jazz Band")).toBe(
      'live-music-dance-party'
    )
  })

  it('A test for (anything inside ) parenthesis', async () => {
    expect(helpers.getSlug('A test for (anything inside ) parenthesis')).toBe(
      'a-test-for-parenthesis'
    )
  })

  it('Remove) extra (parenthesis', async () => {
    expect(helpers.getSlug('Remove) extra (parenthesis')).toBe('remove-extra-parenthesis')
  })

  it('Some party', async () => {
    expect(helpers.getSlug('Some party', ['dj-dance'])).toBe('dj-dance-party')
  })

  it('Specific DJ )Dance Party with extra parenthesis', async () => {
    expect(helpers.getSlug('Specific DJ )Dance Party', ['dj-dance'])).toBe(
      'specific-dj-dance-party'
    )
  })

  it('Some music', async () => {
    expect(helpers.getSlug('Some music', ['dj-dance', 'live-music'])).toBe('live-music-dance-party')
  })

  it('Lots of ––––– dashes', async () => {
    expect(helpers.getSlug('Lots of ––––– dashes')).toBe('lots-of-dashes')
  })

  it('Anything with start date', async () => {
    expect(helpers.getSlug('Anything with start date', [], 'my start date')).toBe(
      'anything-with-start-date'
    )
  })

  it('Dropin Class with start date', async () => {
    expect(helpers.getSlug('Dropin Class with start date', [], 'my start date')).toBe(
      'dropin-class-my-start-date'
    )
  })

  it('Drop-in Class with start date', async () => {
    expect(helpers.getSlug('Drop-in Class with start date', [], 'my start date')).toBe(
      'drop-in-class-my-start-date'
    )
  })

  it('DJ Dance with start date', async () => {
    expect(helpers.getSlug('DJ Dance with start date', [], 'my start date')).toBe(
      'dj-dance-party-my-start-date'
    )
  })

  it('Live Music with start date', async () => {
    expect(helpers.getSlug('Live Music with start date', [], 'my start date')).toBe(
      'live-music-dance-party-my-start-date'
    )
  })
})
