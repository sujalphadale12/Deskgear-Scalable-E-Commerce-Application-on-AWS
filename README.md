# BookHaven – Highly Available 3-Tier Book Shopping Application on AWS

A production-style **3-tier web application architecture on AWS** using Amazon VPC, Application Load Balancer, EC2, Auto Scaling, Amazon RDS MySQL, NAT Gateways, and a bastion/jump server.

The project demonstrates how to deploy a Node.js application securely across public and private subnets while keeping the database private.

---

## 1. Project Overview

**BookHaven** is a full-stack online bookstore application that allows users to:

- Browse books
- Browse categories
- Search books
- Register and sign in
- Add books to cart
- Place orders
- View application content through a responsive web interface

The application is deployed on AWS using a 3-tier architecture:

```text
                         Internet
                            |
                            v
                  +-------------------+
                  | Application Load  |
                  |    Balancer       |
                  |      ALB :80      |
                  +---------+---------+
                            |
                +-----------+-----------+
                |                       |
                v                       v
        +---------------+       +---------------+
        | App Server    |       | App Server    |
        | EC2 :3000     |       | EC2 :3000     |
        | Private AZ-A  |       | Private AZ-B  |
        +-------+-------+       +-------+-------+
                |                       |
                +-----------+-----------+
                            |
                            v
                   +------------------+
                   |   Amazon RDS     |
                   |   MySQL :3306    |
                   |   Private DB     |
                   +------------------+

        Jump/Bastion Server
        Used only for SSH administration
```

---

## 2. AWS Services Used

| Service | Purpose |
|---|---|
| Amazon VPC | Isolated AWS network |
| EC2 | Application and jump/bastion servers |
| Application Load Balancer | Distributes incoming HTTP traffic |
| Auto Scaling Group | Maintains and scales application instances |
| Amazon RDS MySQL | Managed database |
| Internet Gateway | Internet access for public subnets |
| NAT Gateway | Outbound internet access from private subnets |
| Security Groups | Instance-level network security |
| Route Tables | Control subnet traffic |
| AMI | Application server image for Auto Scaling |
| Launch Template | Defines configuration for new EC2 instances |
| PM2 | Keeps Node.js application running |

---

# 3. VPC Architecture

## VPC Configuration

- **VPC Name:** `vpc-01`
- **VPC CIDR:** `10.10.0.0/16`
- **Region:** Asia Pacific (Mumbai) – `ap-south-1`
- **Availability Zones:** `ap-south-1a` and `ap-south-1b`

The VPC was designed with **6 subnets**:

- 2 Public subnets
- 2 Private Application subnets
- 2 Private Database subnets

![VPC Architecture](images/vpc-resource-map.png)

---

# 4. Subnet Design

The six subnets are distributed across two Availability Zones.

| Tier | Availability Zone | Subnet | CIDR |
|---|---|---|---|
| Public | ap-south-1a | `public-subnet-az1` | `10.10.1.0/24` |
| Public | ap-south-1b | `public-subnet-az2` | `10.10.2.0/24` |
| Application | ap-south-1a | `private-app-subnetAZ1` | `10.10.3.0/24` |
| Application | ap-south-1b | `private-app-private-subnetAZ2` | `10.10.4.0/24` |
| Database | ap-south-1a | `private-subnet-db-subnet-az1` | `10.10.5.0/24` |
| Database | ap-south-1b | `private-db-subnetAZ2` | `10.10.6.0/24` |

![Subnets](images/subnets.png)

### Why six subnets?

The design separates the workloads:

```text
Public Subnets
├── Public AZ1
└── Public AZ2

Private Application Subnets
├── App AZ1
└── App AZ2

Private Database Subnets
├── DB AZ1
└── DB AZ2
```

This provides separation between internet-facing components, application servers, and database resources.

---

# 5. Internet Gateway

An Internet Gateway named:

```text
igw1
```

was attached to the VPC.

The Internet Gateway provides internet connectivity for resources in the public subnets.

The public route table contains:

```text
0.0.0.0/0 → Internet Gateway
```

---

# 6. NAT Gateways

Two NAT Gateways were created:

```text
nat-01
nat-02
```

They are placed in public subnets.

Private application subnets use NAT Gateway routes for outbound internet access.

Example:

```text
Private App Subnet
       |
       v
   NAT Gateway
       |
       v
 Internet Gateway
       |
       v
    Internet
```

NAT allows private instances to download packages and updates without making them directly reachable from the internet.

---

# 7. Route Tables

Four route tables were created:

```text
public-rt
private-app-rt
private-db-rt
rtb-0d45a8432f2acd03
```

The intended traffic flow is:

### Public Route Table

```text
0.0.0.0/0 → igw1
```

Associated with:

```text
public-subnet-az1
public-subnet-az2
```

### Private Application Route Table

Private application subnets use NAT for outbound internet traffic.

```text
0.0.0.0/0 → NAT Gateway
```

Associated with:

```text
private-app-subnetAZ1
private-app-private-subnetAZ2
```

### Private Database Route Table

Database subnets remain private and do not receive direct internet access.

Associated with:

```text
private-subnet-db-subnet-az1
private-db-subnetAZ2
```

---

# 8. VPC Resource Map

The final VPC resource map shows the relationship between:

- VPC
- 6 subnets
- Route tables
- Internet Gateway
- NAT Gateways

![VPC Resource Map](images/vpc-resource-map.png)

---

# 9. Security Groups

The architecture uses separate Security Groups for each tier.

## ALB-SG

Allows public web traffic:

| Type | Port | Source |
|---|---:|---|
| HTTP | 80 | `0.0.0.0/0` |
| HTTPS | 443 | `0.0.0.0/0` |

---

## APP-SG

Allows application traffic only from the Application Load Balancer.

| Type | Port | Source |
|---|---:|---|
| Custom TCP | 3000 | ALB-SG |
| SSH | 22 | Jump-SG |

The application port is **not directly exposed to the internet**.

---

## RDS-SG

Allows MySQL traffic only from the application tier.

| Type | Port | Source |
|---|---:|---|
| MySQL | 3306 | APP-SG |

The RDS database is not publicly accessible.

---

# 10. Jump / Bastion Server

A public EC2 instance is used as the **Jump/Bastion Server**.

Purpose:

```text
Administrator
     |
     v
Jump Server
     |
     v
Private App Server
```

The jump server is used for SSH administration of private application instances.

It is not part of the Auto Scaling Group.

---

# 11. Application Server

The application runs on Amazon EC2 using Node.js.

Application directory:

```bash
/home/ec2-user/bookhaven-aws-3tier-architecture
```

The application listens on:

```text
Port 3000
```

Node.js application:

```text
BookHaven
```

---

# 12. Node.js Installation

Node.js was installed on the application server.

Verify:

```bash
node -v
npm -v
```

Navigate to the project:

```bash
cd ~/bookhaven-aws-3tier-architecture
```

Install dependencies:

```bash
npm install
```

---

# 13. Environment Configuration

The application uses environment variables for database connectivity.

Example:

```env
PORT=3000
DB_HOST=<RDS-ENDPOINT>
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=<DATABASE-PASSWORD>
DB_NAME=bookhaven
JWT_SECRET=<JWT-SECRET>
```

The RDS endpoint is used as `DB_HOST`.

---

# 14. Amazon RDS MySQL

Amazon RDS MySQL is used as the database tier.

Database configuration shown in the AWS console:

```text
Database: ecommerce-db
Engine: MySQL
Port: 3306
Publicly accessible: No
VPC: vpc-01
```

![RDS Database](images/rds-database.png)

The database is located in private database subnets.

---

# 15. RDS Subnet Group

The RDS subnet group is:

```text
ecommerce-db-subnet-group
```

It contains two private database subnets:

| AZ | Subnet | CIDR |
|---|---|---|
| ap-south-1a | `private-subnet-db-subnet-az1` | `10.10.5.0/24` |
| ap-south-1b | `private-db-subnetAZ2` | `10.10.6.0/24` |

![RDS Subnet Group](images/rds-subnet-group.png)

---

# 16. Database Connectivity

The application connects to RDS using:

```text
App EC2
   |
   | TCP 3306
   v
RDS MySQL
```

Security is controlled using Security Groups:

```text
APP-SG → RDS-SG : 3306
```

The database does not need a public IP.

---

# 17. Database Schema

The BookHaven application uses tables such as:

```text
users
books
categories
cart
orders
order_items
```

The database stores application data while the Node.js application handles business logic.

---

# 18. Application Load Balancer

An Internet-facing Application Load Balancer named:

```text
alb-01
```

was created.

Configuration:

```text
Type: Application Load Balancer
Scheme: Internet-facing
IP type: IPv4
Availability Zones:
    ap-south-1a
    ap-south-1b
```

![Application Load Balancer](images/alb.png)

The ALB receives traffic on:

```text
HTTP :80
```

and forwards it to the application target group on:

```text
HTTP :3000
```

---

# 19. ALB Traffic Flow

The complete request path is:

```text
Browser
   |
   | HTTP :80
   v
ALB
   |
   | HTTP :3000
   v
Node.js App EC2
   |
   | MySQL :3306
   v
RDS MySQL
```

This is the main 3-tier request flow.

---

# 20. Target Group

The target group used by the ALB is:

```text
tg-02
```

Configuration:

```text
Target type: Instance
Protocol: HTTP
Port: 3000
```

The target group forwards traffic to the Node.js application.

### Important

The ports are different because each component has a different responsibility:

```text
ALB Listener       → 80
Target Group       → 3000
Node.js App        → 3000
RDS MySQL          → 3306
```

---

# 21. Health Check

The target group uses:

```text
Protocol: HTTP
Path: /health
Port: Traffic port
Success code: 200
```

The Node.js application provides:

```text
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

This endpoint allows the ALB to determine whether an application instance is healthy.

---

# 22. PM2 Process Manager

PM2 is used to keep the Node.js application running.

Install:

```bash
sudo npm install -g pm2
```

Start the application:

```bash
cd ~/bookhaven-aws-3tier-architecture

pm2 start server.js --name bookhaven
```

Check:

```bash
pm2 status
```

Check application logs:

```bash
pm2 logs bookhaven
```

Test locally:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

---

# 23. PM2 Startup for Auto Scaling

For an EC2 instance that will be used as the base AMI, configure PM2 to start after reboot.

First make sure the application is running:

```bash
pm2 status
```

Then:

```bash
pm2 save
```

Generate the startup command:

```bash
pm2 startup
```

Run the command displayed by PM2.

Then save the process list again:

```bash
pm2 save
```

> Important: Run these commands on the **application server**, not on the jump server.

---

# 24. Creating the AMI

After the application server is fully configured and tested, create an AMI.

The AMI should contain:

- Node.js
- npm dependencies
- BookHaven application
- Environment configuration
- PM2
- PM2 startup configuration
- Required OS configuration

AWS Console:

```text
EC2
 → Instances
 → Select App Server
 → Actions
 → Image and templates
 → Create image
```

Example name:

```text
bookhaven-app-ami
```

---

# 25. Launch Template

Create a Launch Template using the BookHaven AMI.

Example:

```text
Name:
bookhaven-launch-template
```

Configure:

```text
AMI:
BookHaven App AMI

Instance type:
t2.micro / eligible free-tier instance

Security Group:
APP-SG

Key Pair:
Required key pair

Subnet:
Selected by Auto Scaling Group
```

The Launch Template defines how new application servers are created.

---

# 26. Auto Scaling Group

Create an Auto Scaling Group for the application tier.

Example:

```text
Name:
bookhaven-asg
```

Use:

```text
Launch Template:
bookhaven-launch-template
```

Select the private application subnets:

```text
private-app-subnetAZ1
private-app-private-subnetAZ2
```

---

# 27. Auto Scaling Capacity

Recommended project configuration:

```text
Minimum capacity: 2
Desired capacity: 2
Maximum capacity: 4
```

This means:

```text
Normal:
2 App EC2 instances

High traffic:
up to 4 App EC2 instances
```

The ALB distributes traffic between healthy instances.

---

# 28. Attach Auto Scaling Group to Target Group

During ASG creation, attach:

```text
Target Group:
tg-02
```

Traffic flow becomes:

```text
ALB
 |
 +----------------+
 |                |
 v                v
App EC2 #1      App EC2 #2
 |                |
 +-------+--------+
         |
         v
      RDS MySQL
```

New instances launched by the ASG automatically register with the target group.

---

# 29. Health Checks for Auto Scaling

Enable:

```text
ELB health checks
```

The ASG can use the ALB health status to help determine whether instances are healthy.

The application must respond successfully to:

```text
/health
```

with HTTP:

```text
200
```

---

# 30. Scaling Policy

A target tracking policy can be configured using average CPU utilization.

Example:

```text
Metric:
Average CPU Utilization

Target:
50%
```

Example behavior:

```text
CPU increases
      ↓
ASG launches another EC2
      ↓
New EC2 starts BookHaven
      ↓
Target becomes healthy
      ↓
ALB sends traffic to it
```

When demand decreases, Auto Scaling can remove excess instances while maintaining the configured minimum.

---

# 31. Website Verification

Open the ALB DNS name in a browser:

```text
http://alb-01-726545695.ap-south-1.elb.amazonaws.com
```

The BookHaven website should load.

![BookHaven Website](images/bookhaven-website.png)

The website provides:

- Book browsing
- Categories
- Search
- Sign in
- Registration
- Cart
- Orders

---

# 32. API Verification

Test the application directly from the App EC2:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

Test books API:

```bash
curl http://localhost:3000/api/books
```

Test through the ALB:

```bash
curl http://alb-01-726545695.ap-south-1.elb.amazonaws.com/api/books
```

A successful response confirms:

```text
ALB
 ↓
Target Group
 ↓
Node.js
 ↓
RDS
```

---

# 33. Common 502 Bad Gateway Troubleshooting

If the ALB displays:

```text
502 Bad Gateway
```

check the target group.

Go to:

```text
EC2
 → Target Groups
 → tg-02
 → Targets
```

The target should show:

```text
Healthy
```

If it shows:

```text
Unhealthy
```

check the following.

### Check 1 – Node.js application

```bash
pm2 status
```

The process should be:

```text
online
```

### Check 2 – Port 3000

```bash
sudo ss -lntp | grep 3000
```

### Check 3 – Health endpoint

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

### Check 4 – Security Group

APP-SG must allow:

```text
TCP 3000
Source: ALB-SG
```

Do not use:

```text
0.0.0.0/0
```

for the application port in the final architecture.

### Check 5 – Target Group

Verify:

```text
Protocol: HTTP
Port: 3000
Health path: /health
Success code: 200
```

### Check 6 – Application binding

The Node.js application must listen on an address reachable from the ALB, not only a loopback-only interface.

---

# 34. Final Architecture

```text
                              INTERNET
                                  |
                                  v
                     +-----------------------+
                     |   Application Load    |
                     |      Balancer         |
                     |       alb-01          |
                     |        HTTP :80       |
                     +-----------+-----------+
                                 |
                    +------------+------------+
                    |                         |
                    v                         v
          +------------------+       +------------------+
          | Private App AZ1  |       | Private App AZ2  |
          |     EC2 :3000    |       |     EC2 :3000    |
          |     APP-SG       |       |     APP-SG       |
          +--------+---------+       +---------+--------+
                   |                           |
                   +-------------+-------------+
                                 |
                                 v
                       +-------------------+
                       |   Amazon RDS      |
                       |     MySQL         |
                       |      :3306        |
                       |     RDS-SG        |
                       +-------------------+

                  PRIVATE DATABASE SUBNETS
                       AZ1       AZ2

Jump/Bastion Server
       |
       +---- SSH ----> Private Application Servers
```

---

# 35. Complete Request Flow

```text
User Browser
     |
     | HTTP :80
     v
Internet Gateway
     |
     v
Application Load Balancer
     |
     | HTTP :3000
     v
Target Group
     |
     +----------------------+
     |                      |
     v                      v
App EC2 AZ1             App EC2 AZ2
     |                      |
     +----------+-----------+
                |
                | MySQL :3306
                v
             RDS MySQL
```

---

# 36. Auto Scaling Flow

```text
                 Application Load Balancer
                           |
                 +---------+---------+
                 |                   |
                 v                   v
              EC2 #1              EC2 #2
                 \                   /
                  \                 /
                   +-------+-------+
                           |
                        RDS MySQL


                  High CPU / Traffic
                           |
                           v
                    Auto Scaling Group
                           |
                           v
                       EC2 #3
                           |
                           v
                    Target Group
                           |
                           v
                           ALB
```

---

# 37. Security Architecture

The project follows a layered network security model.

```text
Internet
   |
   | 80/443
   v
ALB-SG
   |
   | 3000
   v
APP-SG
   |
   | 3306
   v
RDS-SG
```

SSH access:

```text
Jump-SG
   |
   | 22
   v
APP-SG
```

The database is never directly exposed to the public internet.

---

# 38. Final Verification Checklist

### VPC

- [x] VPC created
- [x] CIDR `10.10.0.0/16`
- [x] Two Availability Zones
- [x] Six subnets

### Networking

- [x] Internet Gateway
- [x] NAT Gateways
- [x] Public route table
- [x] Private application route table
- [x] Private database route table

### Database

- [x] RDS MySQL
- [x] RDS subnet group
- [x] Two database subnets
- [x] RDS not publicly accessible
- [x] Port 3306 restricted to APP-SG

### Application

- [x] Node.js installed
- [x] BookHaven deployed
- [x] Port 3000
- [x] PM2 configured
- [x] `/health` endpoint working

### Load Balancer

- [x] Internet-facing ALB
- [x] Two Availability Zones
- [x] HTTP listener port 80
- [x] Target Group port 3000
- [x] `/health` health check

### Auto Scaling

- [x] AMI created
- [x] Launch Template
- [x] Auto Scaling Group
- [x] Private application subnets
- [x] Target Group attached
- [x] ELB health checks
- [x] Scaling policy

---

# 39. Screenshots

## BookHaven Application

![BookHaven Application](images/bookhaven-website.png)

## Application Load Balancer

![Application Load Balancer](images/alb.png)

## Amazon RDS

![Amazon RDS](images/rds-database.png)

## VPC

![VPC](images/vpc.png)

## Six Subnets

![Six Subnets](images/subnets.png)

## VPC Resource Map

![VPC Resource Map](images/vpc-resource-map.png)

## RDS Subnet Group

![RDS Subnet Group](images/rds-subnet-group.png)

---

# 40. Conclusion

BookHaven demonstrates a secure and scalable AWS 3-tier architecture.

The final architecture separates:

```text
Presentation / Traffic Layer
        ↓
Application Layer
        ↓
Database Layer
```

The use of an Application Load Balancer and Auto Scaling Group allows the application tier to scale horizontally, while Amazon RDS provides a managed MySQL database.

The six-subnet VPC design separates public, application, and database workloads across two Availability Zones.

---

## Project Highlights

- AWS VPC networking
- Six-subnet architecture
- Multi-AZ design
- Public and private subnets
- Internet Gateway
- NAT Gateways
- Route tables
- Security Groups
- Bastion/Jump Server
- Node.js
- PM2
- Application Load Balancer
- Target Groups
- Health checks
- Amazon RDS MySQL
- Launch Templates
- AMI
- Auto Scaling Group
- Horizontal scaling
- Secure database isolation

---

## Author

**Sujal Phadale**

B.Tech Computer Science & Engineering  
Pimpri Chinchwad University, Pune
