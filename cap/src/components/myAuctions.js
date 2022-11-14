import React, { Component } from 'react'
import { Table, Button, InputGroup } from 'react-bootstrap';
import { get_secret, getPublicKey } from '../pub_pvt';

class MyAuctions extends Component {
  constructor(props) {
    super(props)
    this.state = {
      web3: null,
      accounts: null,
      currentAccount: null,
      blind_contract: null,
      listings: [],
      makebid: false,
      formData: {}
    }
    this.handleChange = this.handleChange.bind(this);
    this.endAuction = this.endAuction.bind(this);
    this.sellItem = this.sellItem.bind(this);

  }
  componentDidMount = async () => {
    try {
      this.setState({
        blind_contract: this.props.blind_contract,
        web3: this.props.web3,
        currentAccount: this.props.account,
      });
      let mylist = []
      let offSet = 1000;
      let blindAuctions = await this.props.blind_contract.methods.getallauctions().call({ from: this.props.account });
      for (let i = 0; i < blindAuctions.length; ++i) {
        if (blindAuctions[i]["beneficiary"] === this.props.account) {
          blindAuctions[i]["type"] = "Blind Auction";
          blindAuctions[i]["new_auction_id"] = parseInt(blindAuctions[i]["auction_id"]) + offSet;
          blindAuctions[i]["bidding_deadline"] = new Date(blindAuctions[i]["biddingEnd"] * 1000);
          blindAuctions[i]["reveal_deadline"] = new Date(blindAuctions[i]["revealEnd"] * 1000);
          mylist.push(blindAuctions[i]);
        }
      }
      this.setState({ listings: mylist });
    } catch (error) {
      alert(`Loading error...`);
    }
  };

  handleChange(e) {
    e.preventDefault();
    const formData = Object.assign({}, this.state.formData);
    formData[e.target.id] = e.target.value;
    this.setState({ formData: formData });
  };

  sellItem = (auction_id, type) => async (e) => {
    try {
      if (type === "Blind Auction") {
        let marketListings = await this.state.blind_contract.methods.getallauctions().call({ from: this.state.currentAccount });
        let pubkey = marketListings[auction_id].pubkey;
        let secret = await get_secret(pubkey, this.state.formData.unique_string);
        let value = (marketListings[auction_id].finalBid * 2);
        await this.state.blind_contract.methods.sellItem(auction_id, secret)
          .send({
            from: this.state.currentAccount,
            value
          });

      } 
    } catch (error) {
      alert(`Sell Item Error: ${error}`);
    }
  };

  endAuction = (auction_id, type) => async (e) => {
    e.preventDefault();
    const { blind_contract} = this.state;
    try {
      if (type === "Blind Auction") {
        await blind_contract.methods.auctionEnd(
          parseInt(auction_id)
        ).send({
          from: this.state.currentAccount
        });
      } 
    } catch (error) {
      alert(`End Auction Error: ${error.message}`);
    }
  };

  render() {
    return (
      <>
        <h2>My Listed Auctions</h2>
        <br />
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}>
          <Table striped bordered hover>
            <thead>
              <tr>
                <td>Listing ID</td>
                <td>Listing Type</td>
                <td>Item Name</td>
                <td>Item Description</td>
                <td>Item Price</td>
                <td>Bidding Deadline</td>
                <td>Bid Reveal Deadline</td>
                <td>Manage</td>
              </tr>
            </thead>
            <tbody>
              {this.state.listings.map(listing => {
                let status = 'Active'
                if (listing.type === "Blind Auction") {
                  if (listing.buyer_alloted) {
                    status = 'Requested'
                  }
                  if (listing.H) {
                    status = 'Sold'
                  }
                  if (listing.sold_or_withdrawn) {
                    status = 'Done'
                  }
                } else {
                  if (Date.now() > listing.reveal_deadline) {
                    status = 'Reveal Over'
                  }
                  if (listing.ended) {
                    status = 'Ended'
                  }
                  if (listing.H) {
                    status = 'Sold'
                  }
                  if (listing.sold) {
                    status = 'Done'
                  }
                }
                return (
                  <tr key={listing.new_auction_id}>
                    <td>{listing.new_auction_id}</td>
                    <td>{listing.type}</td>
                    <td>{listing.item_name}</td>
                    <td>{listing.item_description}</td>
                    <td>{listing.type !== "Blind Auction" ? "NA" : listing.price}</td>
                    <td>{listing.type !== "Blind Auction" ? listing.bidding_deadline.toString() : listing.bidding_deadline}</td>
                    <td>{listing.type !== "Blind Auction" ? listing.reveal_deadline.toString() : listing.reveal_deadline}</td>
                    <td>
                      {listing.type === "Blind Auction" ?
                        (status === 'Active') ?
                          <Button variant="outline-success" disabled>Active</Button>
                          :
                          (status === 'Requested') ?
                            <>
                              <p>Item requested. <br /> Buyer: {listing.buyer ? listing.buyer : "None"} <br /> Selling Price: {listing.price}</p>
                              <input type="string" className="form-control" id="unique_string" required onChange={this.handleChange} placeholder="Unique String" />
                              <Button variant="success" onClick={this.sellItem(listing.auction_id, listing.type)}>Sell Item</Button>
                            </>
                            :
                            (status === 'Sold') ?
                              <>
                                <Button variant="outline-info" disabled>Out for Delivery</Button>
                                <p><br /> Buyer: {listing.buyer ? listing.buyer : "None"} <br /> Selling Price: {listing.price}</p>
                              </>
                              :
                              (status === 'Done') ?
                                <>
                                  <Button variant="outline-success" disabled>Delivered</Button>
                                  <p><br /> Buyer: {listing.buyer ? listing.buyer : "None"} <br /> Selling Price: {listing.price}</p>
                                </>
                                :
                                <></>
                        :
                        // Auctions
                        (status === 'Active') ?
                          <Button variant="outline-success" disabled>Active</Button>
                          :
                          (status === 'Reveal Over') ?
                            <Button onClick={this.endAuction(listing.auction_id, listing.type)} variant="danger">End Auction</Button>
                            :
                            (status === 'Ended') ?
                              <>
                                <p>Auction Ended Successfully. <br /> Winner: {listing.finalBid > 0 ? listing.winner : "None"} <br /> Winning Bid: {listing.finalBid > 0 ? listing.finalBid : "NA"}</p>
                                {listing.finalBid > 0 &&
                                  <>
                                    <input type="string" className="form-control" id="unique_string" required onChange={this.handleChange} placeholder="Unique String" />
                                    <Button variant="success" onClick={this.sellItem(listing.auction_id, listing.type)}>Sell Item</Button>
                                  </>
                                }
                              </>
                              :
                              (status === 'Sold') ?
                                <>
                                  <Button variant="outline-info" disabled>Out for Delivery</Button>
                                </>
                                :
                                (status === 'Done') ?
                                  <>
                                    <Button variant="outline-success" disabled>Delivered</Button>
                                  </>
                                  :
                                  <></>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      </>
    );
  }
}
export default MyAuctions;