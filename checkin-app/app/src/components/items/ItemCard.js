import React from 'react'
import { Link } from 'react-router-dom'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Grid, Card, Label, Item, Button, Accordion } from 'semantic-ui-react'
import dayjs from 'dayjs'
import CountdownTimer from '../countdown'
import { getTimeRange, resizeImage, getImageSrc, formatDuration } from './helpers'
import { selectors as refreshSelectors } from '../../refresh'

const ItemCard = ({ evt, product, settings }) => (
  <Card fluid>
    <Card.Content>
      <Grid container verticalAlign="middle">
        <Grid.Row>
          <Grid.Column computer={12} tablet={12} mobile={16}>
            <Item.Group>
              <Item>
                {!evt.custom_fields ||
                (!evt.custom_fields['Instructor 1 Photo'] &&
                  !evt.custom_fields['Instructor 2 Photo']) ? (
                  ''
                ) : (
                  <div
                    className="image"
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      width: 'auto',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {[1, 2].map(
                      idx =>
                        evt.custom_fields &&
                        evt.custom_fields[`Instructor ${idx} Photo`] && (
                          <Item.Image
                            key={idx}
                            size="small"
                            shape="circular"
                            src={getImageSrc(evt.custom_fields[`Instructor ${idx} Photo`])}
                            as={Link}
                            to={`/items/${evt.slug}`}
                          />
                        )
                    )}
                  </div>
                )}
                {!product.image ? (
                  ''
                ) : (
                  <div
                    className="image"
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      width: 'auto',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Item.Image
                      key={product.image}
                      size="small"
                      shape="circular"
                      src={resizeImage(product.image)}
                      as={Link}
                      to={`/items/${product.slug}`}
                    />
                  </div>
                )}
                <Item.Content verticalAlign="middle">
                  <Item.Header>{evt.title || product.name}</Item.Header>
                  {!evt.custom_fields ? null : (
                    <Item.Meta>
                      <div>
                        {[1, 2].map(
                          idx =>
                            evt.custom_fields &&
                            evt.custom_fields[`Instructor ${idx}`] && (
                              <div style={{ display: 'inline' }} key={idx}>
                                {idx === 1 && <span style={{ color: '#aaa' }}>with</span>}
                                {idx === 2 && <span style={{ fontWeight: '700' }}>&</span>}
                                <span style={{ fontWeight: '700' }}>
                                  {evt.custom_fields[`Instructor ${idx}`].replace('&amp;', '&')}
                                </span>
                              </div>
                            )
                        )}
                      </div>
                    </Item.Meta>
                  )}
                  {evt.start_date || !product.price ? null : (
                    <Item.Meta>
                      <div>
                        <div style={{ display: 'inline' }}>
                          <span style={{ fontWeight: '700' }}>
                            {`Price: ${product.price === '0' ? 'FREE' : `$${product.price}`}`}
                          </span>
                        </div>
                      </div>
                    </Item.Meta>
                  )}
                  {!evt.start_date || !evt.week_number ? null : (
                    <Item.Extra className="item-extra">
                      <Label color="teal" size="medium">
                        {getTimeRange(evt.start_date, evt.end_date)}
                      </Label>
                      <Label size="medium">
                        Week &nbsp;
                        {evt.week_number}
                      </Label>
                      {!(evt.custom_fields && evt.custom_fields['Role type']) ? (
                        ''
                      ) : (
                        <Label basic size="medium">
                          {evt.custom_fields['Role type']}
                        </Label>
                      )}
                    </Item.Extra>
                  )}
                </Item.Content>
              </Item>
            </Item.Group>
          </Grid.Column>
          <Grid.Column
            computer={4}
            tablet={4}
            mobile={16}
            textAlign="center"
            verticalAlign={settings.uiItems.itemsShowDescription ? 'bottom' : 'middle'}
            stretched
          >
            {!evt.start_date ? null : (
              <Button
                size="large"
                as={Link}
                color="blue"
                to={`/items/${evt.slug}`}
                className="class-started-button"
              >
                <CountdownTimer
                  startsIn="Starts in"
                  started="Started"
                  startedSuffix="ago"
                  updateFunc={() => formatDuration(dayjs(), dayjs(evt.start_date))}
                />
              </Button>
            )}
            {evt.start_date ? null : (
              <Button
                size="large"
                as={Link}
                color="blue"
                to={`/items/${product.slug}`}
                className="item-button"
              >
                See Registrants
              </Button>
            )}
          </Grid.Column>
        </Grid.Row>
        {!settings.uiItems.itemsShowDescription || !evt.description ? null : (
          <Grid.Row className="item-description">
            <Accordion
              exclusive={false}
              panels={[
                {
                  key: `accordion-description-${evt.slug}`,
                  title: 'DESCRIPTION',
                  content: {
                    content: <div dangerouslySetInnerHTML={{ __html: evt.description }} />,
                  },
                },
              ]}
            />
          </Grid.Row>
        )}
      </Grid>
    </Card.Content>
  </Card>
)

ItemCard.defaultProps = {
  evt: {},
  product: {},
}

ItemCard.propTypes = {
  evt: PropTypes.objectOf(() => true),
  product: PropTypes.objectOf(() => true),
  settings: PropTypes.objectOf(() => true).isRequired,
}

const mapStateToProps = state => ({
  settings: refreshSelectors.settings(state),
})

export default connect(mapStateToProps)(ItemCard)
