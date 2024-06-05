import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';
import otpGenerator from 'otp-generator';
import multer from 'multer';
import fs from 'fs';
import csv from 'csv-parser';


const app = express();
app.use(express.json());
app.use(cors());


// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
   user: 'mail',
   pass: 'password',
  },
 });

// Function to send OTP via email
async function sendOTP(email) {
  // Generate OTP
  const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });

  // Create a transporter object using SMTP transport
  let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
          user: 'mail',
          pass: 'password'
      }
  });

  // Email message options
  let mailOptions = {
      from: 'sriharimuppalla64@gmail.com',
      to: email,
      subject: 'OTP for Email Verification',
      text: `Your OTP for email verification is: ${otp}`
  };

  // Send mail with defined transport object
  let info = await transporter.sendMail(mailOptions);

  console.log('Email sent: ' + info.response);

  // Return the OTP for further verification
  return otp;
}

const otpStore = {};

// Endpoint to send OTP
app.post('/sendotp', async (req, res) => {
  const { email } = req.body;

    try {
        const otp = await sendOTP(email);
        otpStore[email] = otp;
        res.json({ success: true, otp: otp });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ success: false, error: 'Error sending OTP' });
    }
});
  

// Endpoint to verify OTP
app.post('/verifyotp', (req, res) => {
  const { email, otp } = req.body;

  // Check if the OTP exists in the store
  if (otpStore[email] && otpStore[email] === otp) {
      // If OTP matches, remove it from the store (OTP can only be used once)
      delete otpStore[email];
      res.json({ success: true });
  } else {
      res.status(400).json({ success: false, error: 'Invalid OTP' });
  }
});

// Test mail section start

// Function to send test email
async function sendTestEmail(subject, testEmail, templateCode) {
  try {
    // Create email message options
    let mailOptions = {
      from: 'your-email@gmail.com', // Update with your email
      to: testEmail,
      subject: subject,
      html: templateCode // Assuming HTML template code is sent
    };

    // Send email
    let info = await transporter.sendMail(mailOptions);
    console.log('Test email sent:', info.response);
    return { success: true, message: 'Test email sent successfully' };
  } catch (error) {
    console.error('Error sending test email:', error);
    throw new Error('Error sending test email');
  }
}

// Endpoint to send test email
app.post('/send-test-email', async (req, res) => {
  const { subject, testEmail, templateCode } = req.body;

  try {
    // Send test email
    const result = await sendTestEmail(subject, testEmail, templateCode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test mail section end




const databasePath = "edits.db";

// Open the SQLite database
let db;
(async () => {
  db = await open({
    filename: databasePath,
    driver: sqlite3.Database
  });

  // Create table for registration if not exists
  await db.run(`CREATE TABLE IF NOT EXISTS client_data_listing1 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    segmentName TEXT,
    emailList TEXT,
    createdDate TEXT,
    createdTime TEXT
  )`);

  
})();


// Image Uploader Start

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage }).array('images');

// Route to handle image uploads
app.post('/imagesuploader', (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Multer error
      return res.status(500).json({ success: false, error: err.message });
    } else if (err) {
      // Other errors
      return res.status(500).json({ success: false, error: err.message });
    }

    // If upload is successful, return the file names
    const images = req.files.map(file => ({
      name: file.originalname,
      url: `http://localhost:5000/${file.path}`,
      uploadedAt: new Date().toISOString()
    }));
    res.status(200).json({ success: true, images });
  });
});

// Serve uploaded images
app.use(express.static('uploads'));

// Image Uploader End


// Data Listing Start

// Endpoint to handle file upload and process data
// Route to save client data
app.post('/save-client-data', (req, res) => {
  const { segmentName, emailList, createdDate, createdTime } = req.body;
  
  db.run(`INSERT INTO client_data_listing1 (segmentName, emailList, createdDate, createdTime) VALUES (?, ?, ?, ?)`,
    [segmentName, emailList.join(','), createdDate, createdTime], // Join emailList array into a comma-separated string
    (err) => {
      if (err) {
        console.error('Error inserting client data:', err);
        res.status(500).json({ success: false, error: 'Error inserting client data' });
      } else {
        res.status(201).json({ success: true, message: 'Client data saved successfully' });
      }
    }
  );
});

app.get('/fetch-client-data', async (req, res) => {
  try {
    const clientData = await db.all('SELECT id, segmentName, emailList, createdDate, createdTime FROM client_data_listing1 ORDER BY id DESC');
    res.json(clientData);
  } catch (error) {
    console.error('Error fetching client data:', error);
    res.status(500).json({ error: 'Error fetching client data' });
  }
});
// Data Listing Start


app.post('/savecode', async (req, res) => {
  const { templateName, code, date, time } = req.body;

  try {
    // Insert code snippet into the database
    const result = await db.run('INSERT INTO sample_code_snippets (templateName, snippet, date, time) VALUES (?, ?, ?, ?)', [templateName, code, date, time]);
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    console.error('Error saving code:', error);
    res.status(500).json({ success: false, error: 'Error saving code' });
  }
});

app.get('/templates', async (req, res) => {
  try {
    const templates = await db.all('SELECT id, templateName, snippet, date, time FROM sample_code_snippets ORDER BY id DESC');
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Error fetching templates' });
  }
});

// Endpoint to duplicate a template
app.post('/duplicate', async (req, res) => {
  const { templateId } = req.body;

  try {
    // Retrieve template data from the database
    const template = await db.get('SELECT * FROM sample_code_snippets WHERE id = ?', [templateId]);
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }

    // Duplicate template data
    const duplicatedTemplate = { ...template };
    delete duplicatedTemplate.id;

    // Set new date and time for duplicated template
    const currentDate = new Date().toISOString().slice(0, 10);
    const currentTime = new Date().toTimeString().slice(0, 5);
    const currentName = `${template.templateName} (Copy)`;
    duplicatedTemplate.date = currentDate;
    duplicatedTemplate.time = currentTime;

    // Insert duplicated template into the database
    const result = await db.run('INSERT INTO sample_code_snippets (templateName, snippet, date, time) VALUES (?, ?, ?, ?)', 
      [currentName, template.snippet, currentDate, currentTime]);
    
    res.status(200).json({ success: true, duplicatedTemplate: { id: result.lastID, ...duplicatedTemplate } });
  } catch (error) {
    console.error('Error duplicating template:', error);
    res.status(500).json({ success: false, error: 'Error duplicating template' });
  }
});

// Route to delete a template
app.delete('/templatedelete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Delete the template from the database based on ID
    await db.run('DELETE FROM sample_code_snippets WHERE id = ?', [id]);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: 'Error deleting template' });
  }
});


// Endpoint to retrieve code snippet from the database or update it
app.route('/template/:id')
  .get(async (req, res) => {
    const { id } = req.params;

    try {
      // Fetch code snippet from the database based on ID
      const snippet = await db.get('SELECT templateName, snippet FROM sample_code_snippets WHERE id = ?', [id]);
      if (!snippet) {
        return res.status(404).json({ success: false, error: 'Code snippet not found' });
      }
      res.json({ success: true, code: snippet.snippet, name: snippet.templateName });
    } catch (error) {
      console.error('Error retrieving code:', error);
      res.status(500).json({ success: false, error: 'Error retrieving code' });
    }
  })
  .put(async (req, res) => {
    const { id } = req.params;
    const { templateName, code, date, time } = req.body;

    try {
      // Check if the template exists
      const existingTemplate = await db.get('SELECT * FROM sample_code_snippets WHERE id = ?', [id]);
      if (!existingTemplate) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      // Update the template
      await db.run('UPDATE sample_code_snippets SET templateName = ?, snippet = ?, date = ?, time = ? WHERE id = ?', [templateName, code, date, time, id]);

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ success: false, error: 'Error updating template' });
    }
  });

// Endpoint to fetch all user data after login
app.post('/getusersdata', async (request, response) => {
  const token = request.headers.authorization?.split(' ')[1]; // Extract token from Authorization header
  if (!token) {
    response.status(401).send('Unauthorized');
    return;
  }

  try {
    // Verify token
    const decodedToken = jwt.verify(token, 'secret');
    const userEmail = decodedToken.email;

    // Fetch all client data
    const clientData = await db.all('SELECT * FROM clients_data');

    // Fetch all freelancer data
    const freelancerData = await db.all('SELECT * FROM freelance_users_data');

    // Merge client and freelancer data
    const allUserData = [...clientData, ...freelancerData];

    // Filter out the logged-in user's data from the merged list
    const filteredUserData = allUserData.filter(user => user.email !== userEmail);

    response.json(filteredUserData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    response.status(500).send('Internal Server Error');
  }
});



// Endpoint to fetch user data after login
app.post('/getclientdata', async (request, response) => {
    const token = request.headers.authorization?.split(' ')[1]; // Extract token from Authorization header
    if (!token) {
      response.status(401).send('Unauthorized');
      return;
    }
  
    try {
      // Verify token
      const decodedToken = jwt.verify(token, 'secret');
      const userEmail = decodedToken.email;
  
      // Fetch user data from database
      const userData = await db.get('SELECT firstName, lastName, email, mobileNumber, address FROM clients_data WHERE email = ?', [userEmail]);
      if (!userData) {
        response.status(404).send('User not found');
        return;
      }
  
      response.json(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      response.status(500).send('Internal Server Error');
    }
  });


// Endpoint to fetch freelancer data after login
app.post('/getfreelancerdata', async (request, response) => {
  const token = request.headers.authorization?.split(' ')[1]; // Extract token from Authorization header
  if (!token) {
    response.status(401).send('Unauthorized');
    return;
  }

  try {
    // Verify token
    const decodedToken = jwt.verify(token, 'secret');
    const userEmail = decodedToken.email;

    // Fetch user data from database
    const userData = await db.get('SELECT * FROM freelance_users_data WHERE email = ?', [userEmail]);
    if (!userData) {
      response.status(404).send('User not found');
      return;
    }

    response.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    response.status(500).send('Internal Server Error');
  }
});

// Check if email exists
app.post("/checkemail", async (request, response) => {
    const { email } = request.body;
  
    try {
      const existingEmail = await db.get("SELECT * FROM clients_data WHERE email = ?", [email]);
      if (existingEmail) {
        response.json({ exists: true });
      } else {
        response.json({ exists: false });
      }
    } catch (error) {
      console.error("Error checking email:", error);
      response.status(500).send("Error checking email!");
    }
  });
  
  // Check if phone number exists
  app.post("/checkmobileNumber", async (request, response) => {
    const { mobileNumber } = request.body;
  
    try {
      const existingmobileNumber = await db.get("SELECT * FROM clients_data WHERE mobileNumber = ?", [mobileNumber]);
      if (existingmobileNumber) {
        response.json({ exists: true });
      } else {
        response.json({ exists: false });
      }
    } catch (error) {
      console.error("Error checking phone number:", error);
      response.status(500).send("Error checking phone number!");
    }
  });

// Client Registration endpoint
app.post("/clientregister", async (request, response) => {
  const {
    firstName,
    lastName,
    companyName,
    email,
    mobileNumber,
    address,
    password
  } = request.body;

  try {
    const hashedPasswordC = await bcrypt.hash(password, 10);
    // Check if username or mobile number already exists
    const existingUser = await db.get(
      "SELECT * FROM clients_data WHERE email = ? OR mobileNumber = ?",
      [email, mobileNumber]
    );

    if (existingUser) {
      if (existingUser.email === email) {
        response.status(400).send("email already exists!");
      } else {
        response.status(400).send("Mobile number already registered!");
      }
    } else {
      // Insert new user details
      await db.run(
        "INSERT INTO clients_data (firstName, lastName, companyName, email, mobileNumber, address, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [firstName, lastName, companyName, email, mobileNumber, address, hashedPasswordC]
      );
      response.send("Registration successful!");
    }
  } catch (error) {
    console.error("Registration failed:", error);
    response.status(500).send("Registration failed!");
  }
});


// Freelancer Registration checking
app.post("/freelancercheckemail", async (request, response) => {
    const { email } = request.body;
  
    try {
      const existingEmail = await db.get("SELECT * FROM freelance_users_data WHERE email = ?", [email]);
      if (existingEmail) {
        response.json({ exists: true });
      } else {
        response.json({ exists: false });
      }
    } catch (error) {
      console.error("Error checking email:", error);
      response.status(500).send("Error checking email!");
    }
  });
  
  // Check if phone number exists
  app.post("/freelancercheckmobileNumber", async (request, response) => {
    const { mobileNumber } = request.body;
  
    try {
      const existingmobileNumber = await db.get("SELECT * FROM freelance_users_data WHERE mobileNumber = ?", [mobileNumber]);
      if (existingmobileNumber) {
        response.json({ exists: true });
      } else {
        response.json({ exists: false });
      }
    } catch (error) {
      console.error("Error checking phone number:", error);
      response.status(500).send("Error checking phone number!");
    }
  });

// Freelancer Registration
app.post("/freelancerregister", async (request, response) => {
  const {
    firstName,
    lastName,
    dateOfBirth,
    email,
    mobileNumber,
    address,
    password,
    skills,
    experiences,
    languages,
    educations,
    description
  } = request.body;

  try {
    const hashedPasswordF = await bcrypt.hash(password, 10);
    // Check if username or mobile number already exists
    const existingUser = await db.get(
      "SELECT * FROM freelance_users_data WHERE email = ? OR mobileNumber = ?",
      [email, mobileNumber]
    );

    if (existingUser) {
      if (existingUser.email === email) {
        response.status(400).send("Email already exists!");
      } else {
        response.status(400).send("Mobile number already registered!");
      }
    } else {
      // Insert new user details
      await db.run(
        "INSERT INTO freelance_users_data (firstName, lastName, dateOfBirth, email, mobileNumber, address, password, skills, experiences, languages, educations, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          firstName,
          lastName,
          dateOfBirth,
          email,
          mobileNumber,
          address,
          hashedPasswordF,
          skills,
          JSON.stringify(experiences),
          languages,
          JSON.stringify(educations),
          description
        ]
      );
      response.send("Registration successful!");
    }
  } catch (error) {
    console.error("Registration failed:", error);
    response.status(500).send("Registration failed!");
  }
});


// Client Login endpoint
app.post("/clientlogin", async (request, response) => {
    const { email, password } = request.body;

    try {
        const user = await db.get('SELECT * FROM clients_data WHERE email = ?', [email]);
        if (!user) {
            response.status(401).send('Invalid username or password');
            return;
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
            const token = jwt.sign({ email: user.email }, 'secret');
            response.json({ token });
        } else {
            response.status(401).send('Invalid username or password');
        }
    } catch (error) {
        console.error("Login failed:", error);
        response.status(500).send('Login failed');
    }
});

// Login endpoint
app.post("/freelancerlogin", async (request, response) => {
    const { email, password } = request.body;
  
    try {
        const user = await db.get('SELECT * FROM freelance_users_data WHERE email = ?', [email]);
        if (!user) {
            response.status(401).send('Invalid username or password');
            return;
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
            const token = jwt.sign({ email: user.email }, 'secret');
            response.json({ token });
        } else {
            response.status(401).send('Invalid username or password');
        }
    } catch (error) {
        console.error("Login failed:", error);
        response.status(500).send('Login failed');
    }
  });

// Endpoint to update freelancer password
app.post("/updatepassword", async (request, response) => {
  const { email, newPassword } = request.body;

  try {
    // Fetch the user from the database
    const user = await db.get('SELECT * FROM freelance_users_data WHERE email = ?', [email]);
    if (!user) {
      response.status(404).send('User not found');
      return;
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    await db.run('UPDATE freelance_users_data SET password = ? WHERE email = ?', [hashedNewPassword, email]);
    response.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error("Password update failed:", error);
    response.status(500).send('Password update failed');
  }
});


const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
